# AWS Serverless Migration Tickets

この文書は、ssw を Raspberry Pi 常駐運用から AWS サーバレス構成へ移すためのチケット分割と、各チケットで保持する留保事項を整理するもの。

基本方針は次の通り。

- まず `HTTP API + DynamoDB + S3` で Raspberry Pi 依存を外す。
- Socket.IO から API Gateway WebSocket への移行は後回しにする。
- ローカル開発は維持し、AWS 依存を直接アプリ全体へ染み込ませない。
- 合言葉はサーバ側に平文保存しない。
- git commit、push、PR作成、外部サービスへのデプロイや情報発信は、この整理の対象外。

## Ticket 01: Baseline Safety And Test Alignment

### Goal

移行前の足場を整え、リファクタ時に壊れた箇所を検知できる状態にする。

### Scope

- `/api/messages/create` のリクエストボディ全体ログを削除する。
- メッセージ本文、暗号化payload、合言葉、ファイル名などの機微情報をログへ出さない方針に寄せる。
- 現状のテストと実コードのズレを直す。
- 既存のローカル起動とテスト実行を維持する。

### Reservations

- passphrase hash 化は Ticket 02 で扱う。
- SQLite や local upload の抽象化は Ticket 03 以降で扱う。
- ログ基盤や構造化ログライブラリの導入はまだ行わない。
- UI文言やデザインの改善は対象外。

### Done

- テストが現行仕様に合っている。
- message create のpayload全体がログに出ない。
- 既存のローカル動作が維持されている。

## Ticket 02: Passphrase Contract And Space Identity

### Goal

合言葉をサーバ側に平文保存しないAPI契約へ移行する。

### Scope

- `passphraseHash = HMAC-SHA256(APP_SECRET, normalizedPassphrase)` を導入する。
- サーバ保存値を `passphrase` から `passphraseHash` へ寄せる。
- APIレスポンスから平文 `passphrase` を返さない。
- フロントは入力済み合言葉をクライアント側だけで保持し、暗号鍵生成に使う。
- ローカルSQLite実装でも新契約を使う。

### Reservations

- 既存 `secure_chat.db` のAWS移行は行わない。AWS版はclean DynamoDB/S3で開始する。
- `APP_SECRET` の最終的な置き場所は Ticket 10 のIaCで決める。候補は AWS Secrets Manager か SSM Parameter Store。
- 合言葉の正規化は当面、既存仕様に近い `trim()` を基本にする。NFKCなどUnicode正規化は、既存ユーザーの合言葉互換性に影響するため別判断にする。
- DynamoDBの最終キー設計は Ticket 05 で確定する。

### Done

- サーバが平文合言葉を保存しない。
- APIが平文合言葉を返さない。
- 既存の暗号化、復号のユーザー体験が壊れていない。

## Ticket 03: Storage And File Abstractions For Local Runtime

### Goal

SQLite、local upload、process memory への直依存を薄い抽象層へ移す。

### Scope

- `SpaceStore`、`MessageStore`、`FileStore`、`SessionStore` 相当の境界を作る。
- まずはローカル実装として SQLite と `public/uploads` を使い続ける。
- ルート処理から `better-sqlite3` や `fs` upload への直参照を減らす。
- AWS実装を後から差し込めるデータ形に整える。

### Reservations

- DynamoDB と S3 の実装はまだ入れない。
- Socket.IO の `activeSessions` は、この段階では互換維持を優先する。
- 抽象化は必要最小限にする。大きなフレームワークやDIコンテナは導入しない。
- DBスキーマの破壊的変更は Ticket 02 の範囲を超えない。

### Done

- ローカルExpressアプリが既存通り動く。
- HTTP APIの主要処理がstore境界越しにデータへアクセスする。
- 後続チケットで DynamoDB/S3 実装を追加できる入口がある。

## Ticket 04: Message Query And Polling Mode

### Goal

WebSocket移行前でもAWS上でチャットとして使えるように、HTTP差分取得を用意する。

### Scope

- `GET /api/messages/:spaceId` に `since` などの差分取得パラメータを追加する。
- 期限切れメッセージをAPIレスポンスから除外する。
- フロントに最小限のpolling modeを追加できる形にする。
- 既存Socket.IOがあるローカル環境でもHTTP取得は使えるようにする。

### Reservations

- リアルタイム体験の完成度は Ticket 11 まで留保する。
- polling interval の最終値は運用観察で調整する。初期値は数秒程度でよい。
- DynamoDB TTLは即時削除ではないため、論理的な期限判定はアプリ側に残す。
- 無限スクロールやページングUIの作り込みは対象外。

### Done

- 差分取得で新規メッセージだけを取得できる。
- 期限切れメッセージが返らない。
- Socket.IOなしでも最低限のチャット確認ができる道がある。

## Ticket 05: DynamoDB Storage Implementation

### Goal

HTTP API が DynamoDB を永続化先として使えるようにする。

### Scope

- `SpaceStore` と `MessageStore` の DynamoDB 実装を追加する。
- `Spaces` の一意性を安全に扱う。
- `Messages` は `spaceId` 単位で時系列Queryできるようにする。
- `expiresAtEpoch` を持たせ、TTLとAPI側期限判定に使う。
- ローカルとAWSの実装切替を環境変数で行えるようにする。

### Recommended Design

Spaces の一意性は、次のどちらかで実装する。

1. `Spaces` のPKを `passphraseHash` にし、`spaceId` を属性として持つ。
2. `SpaceLookup` のような別テーブルを用意し、`passphraseHash` を条件付きPutする。

初期実装では 1 を推奨する。既存の主な検索キーが合言葉であり、GSIでは一意制約を保証できないため。

### Reservations

- 既存本番データ移行は行わない。AWS版は新規データストアで開始する。
- 読み書きキャパシティは初期は低コストを優先する。on-demand と provisioned の最終選択は Ticket 10 で決める。
- single-table design は採用しない。現状規模では読みやすさを優先する。
- DynamoDB Streams や追加の非同期処理は導入しない。

### Done

- DynamoDB実装で spaces create/enter と messages create/list が動く。
- 同じ合言葉の重複作成が条件付き書き込みで防がれる。
- 期限切れ判定が `expiresAtEpoch` ベースで動く。

## Ticket 06: S3 File Storage And Presigned URLs

### Goal

ローカル `public/uploads` 依存を外し、暗号化済みファイルをS3へ保存できるようにする。

### Scope

- `FileStore` のS3実装を追加する。
- アップロード用presigned URLを発行するAPIを追加する。
- ダウンロード用presigned URLを発行するAPI、またはメッセージ取得時のURL付与を実装する。
- メッセージには期限付きURLではなく `storageKey` または `s3Key` を保存する。
- フロントのmedia upload/download処理を新契約に合わせる。

### Recommended Design

- アップロードは、サイズ制約を強めたい場合に備えて presigned POST を優先する。
- 実装量を抑える必要がある場合のみ presigned PUT に落とす。
- S3 object key は `spaces/{spaceId}/messages/{messageId}/{random}` のように推測しにくい形にする。

### Reservations

- S3 Lifecycle の最終設定は Ticket 10 で扱う。
- CloudFront経由のprivate object配信は初期実装では必須にしない。まずはpresigned GETでよい。
- WebSocketで画像や音声のbinaryを送る案は採用しない。
- 既存ローカルupload互換は local `FileStore` で維持する。

### Done

- AWS実装ではファイルがS3へ保存される。
- DBには期限付きURLではなく永続的なobject keyが保存される。
- 画像、音声の復号表示が維持される。

## Ticket 07: Lambda HTTP Handlers And API Gateway Shape

### Goal

Express常駐前提から離れ、HTTP APIをLambdaで実行できる形にする。

### Scope

- HTTP API用のLambda handlerを追加する。
- 既存Expressルートとhandlerが同じservice/store層を使うようにする。
- 対象エンドポイントは `/api/config`、`/api/spaces/create`、`/api/spaces/enter`、`/api/messages/:spaceId`、`/api/messages/create`、file presign系。
- CORS、エラー形式、JSONレスポンス形式を揃える。

### Reservations

- API Gateway HTTP APIを推奨する。Function URLは単純だが、将来のCloudFront routingやWebSocket併用を考えると優先しない。
- Express全廃は急がない。ローカル開発用に残してよい。
- 認証基盤は追加しない。現行の合言葉空間モデルを維持する。
- WebSocket routeは Ticket 11 まで扱わない。

### Done

- Lambda handler単体でHTTP API相当の処理が動く。
- ローカルExpressとLambda handlerのビジネスロジックが二重実装になっていない。
- AWS向け環境変数でDynamoDB/S3実装を選べる。

## Ticket 08: Static Hosting And Runtime Config

### Goal

フロントをS3 + CloudFront配信へ移せるようにする。

### Scope

- 静的ファイル配信とAPI originの分離を整理する。
- `/api/*` をHTTP APIへ向ける前提でフロントのAPI呼び出しを確認する。
- WebSocket URLやAPI base URLをruntime configとして扱えるようにする。
- Socket.IOを使わないpolling modeでAWS上のHTTP APIを確認できるようにする。

### Reservations

- CloudFront distribution、証明書、DNS切替の作成は Ticket 10 で扱う。
- 既存のCloudflare DNSを残すか、Route 53へ移すかはDNS切替時まで留保する。低コスト優先ならCloudflare DNS継続を推奨する。
- UIリデザインはしない。
- Socket.IO script削除は Ticket 11 で行う。polling modeが先に入る場合は併存してよい。

### Done

- 静的配信先がRaspberry PiでなくてもAPIへ到達できる設計になっている。
- runtime configでAPI URLや将来のWebSocket URLを切り替えられる。
- HTTP + polling構成で動作確認できる。

## Ticket 09: Archived / Not Planned - Data Migration Plan And Scripts

### Goal

既存Raspberry Pi上のSQLite DBとuploadsはAWSへ移行しない。AWS版はclean DynamoDB/S3で開始する。

### Scope

- このチケットは実運用ロードマップから外す。
- 既存のmigration scriptは参考/将来用として残すが、AWS切替の必須成果物にしない。
- AWS検証と本番切替は、新規spaceと新規messageで確認する。
- Raspberry Pi側の `secure_chat.db` と `public/uploads` は、切替前バックアップまたは予備確認用として扱う。

### Reservations

- 後から既存データ移行が必要になった場合は、新しいチケットとして再計画する。
- 現時点では `APP_SECRET` 互換性や既存passphrase変換を切替条件に含めない。
- 外部S3への既存uploads一括送信は行わない。
- DNS切替やRaspberry Pi停止は Ticket 12 の手順で扱う。

### Done

- Ticket 09 が Archived / Not Planned として明記されている。
- 他チケットの完了条件が既存DB移行を前提にしていない。
- AWS版の検証がclean DynamoDB/S3前提で進められる。

## Ticket 10: AWS Infrastructure, Cost Guards, And Deployment

### Goal

サーバレス実行環境をIaCで作り、コスト事故を避ける最低限のガードを入れる。

### Scope

- API Gateway HTTP API、Lambda、DynamoDB、S3、CloudFrontを定義する。
- 必要なIAM権限を最小化する。
- `APP_SECRET` などの機密設定をAWS側で管理する。
- AWS Budgets または billing alarm を設定する手順を残す。
- S3 Lifecycle と DynamoDB TTL を有効にする。

### Reservations

- IaCツールは CDK か SAM のどちらかを選ぶ必要がある。Node.js中心のプロジェクトなので初期推奨は CDK。
- 実AWSへのデプロイは、ユーザーが明示的に許可するまで行わない。
- Route 53利用は必須にしない。Cloudflare DNS継続を低コスト案として保持する。
- DynamoDB billing mode は、実利用量が読めるまでは on-demand を基本候補にし、無料枠狙いのprovisionedは運用見積もり後に再判断する。

### Done

- IaCでAWSリソースを再現できる。
- 機密値がコードやgit管理対象に入らない。
- コスト通知とTTL/Lifecycleの方針が明文化されている。

## Ticket 11: API Gateway WebSocket Migration

### Goal

Socket.IO常駐サーバ依存をなくし、API Gateway WebSocketでリアルタイム通知と公開鍵中継を行う。

### Scope

- `$connect`、`$disconnect`、`joinSpace`、`newMessage`、`publicKeyAnnouncement` のhandlerを追加する。
- `Connections` テーブルで `connectionId`、`spaceId`、`sessionId`、`publicKey`、`expiresAtEpoch` を管理する。
- 送信時は `spaceId` で接続一覧をQueryし、`ApiGatewayManagementApi.postToConnection` で配信する。
- `GoneException` など切断済み接続を掃除する。
- フロントを native WebSocket に切り替える。

### Reservations

- 初期実装では `sessionId = connectionId` とする。再接続時は新セッション扱いでよい。
- `$disconnect` はbest-effortなので、TTLと送信失敗時掃除を併用する。
- hybrid暗号化は、接続状態の遅延や欠落で失敗しても deterministic fallback を正とする。
- 完全なpresence表示の正確性は保証しない。小規模チャットで体験上問題ない範囲を狙う。
- 画像、音声binaryはWebSocketに流さずS3/HTTP経由のままにする。

### Done

- Socket.IOなしでjoin、message broadcast、public key announcementが動く。
- 切断済みconnectionが自然に掃除される。
- 10分idleや2時間上限を前提にフロントが再接続できる。

## Ticket 12: Final Cutover And Raspberry Pi Decommission Plan

### Goal

AWS版へ安全に切り替え、Raspberry Pi/Cloudflare Tunnel依存を外す。

### Scope

- AWS版の動作確認チェックリストを作る。
- DNSまたはCloudflare側の向き先変更手順を整理する。
- 切り戻し手順を残す。
- Raspberry Pi側の停止タイミングを決める。

### Reservations

- 本番DNS切替はユーザーの明示許可があるまで行わない。
- 一定期間はRaspberry Pi版を読み取り専用または予備として残すかを切替直前に判断する。
- 移行後のログ保持期間とS3保存期間は、実利用量を見て再調整する。
- 外部への公開範囲、カスタムドメイン、TLS証明書の最終設定は切替時に確認する。

### Done

- AWS版で主要ユースケースが通る。
- 切替と切り戻しの手順がある。
- Raspberry Pi停止後もチャット、ファイル、期限切れ処理が動く。

## Cross-ticket Reservations

- 低コストを優先するが、無料枠だけを前提にしない。必ずBudgetやbilling alarmを入れる。
- E2EE風のクライアント暗号化動作は維持する。サーバ側で平文メッセージを扱う変更はしない。
- DynamoDB TTLとS3 Lifecycleは物理削除の仕組みであり、ユーザー表示上の期限切れ判定はアプリ側で行う。
- AWS SDKやIaC依存の追加は、実装チケットで必要になった時点に限定する。
- WebSocketは最後に移す。先にHTTP + pollingでRaspberry Pi依存を外せる形を目指す。
