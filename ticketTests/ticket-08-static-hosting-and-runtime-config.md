# Ticket 08 Test Cases: Static Hosting And Runtime Config

## Goal under test

フロントをS3 + CloudFront配信へ移せるようにする。

## Automated tests

1. API base URLをruntime configから取得できる。
2. runtime configが未設定の場合、既存同一origin `/api` fallbackが動く。
3. WebSocket URLをruntime configとして保持できるが、Ticket 11までは必須にしない。
4. フロントのAPI moduleがhard-coded originに依存しない。
5. polling mode有効時、Socket.IO clientなしでもHTTP APIを呼べる。

## Integration tests

1. 静的ファイルをローカルHTTPサーバから配信し、別originのAPIへ接続できる。
2. CloudFront相当の `/api/*` reverse routingをローカルproxyで再現し、同一origin fallbackが動く。
3. polling modeで空間入室、メッセージ投稿、差分取得が動く。

## Manual checks

1. `index.html` と静的assetがRaspberry Pi固有URLに依存していない。
2. runtime configの置き場所がデプロイ時に差し替えやすい。
3. UIリデザインや不要な画面変更が入っていない。

## Non-goals

- CloudFront distributionの作成は含めない。
- DNS切替は含めない。
- Socket.IO script削除はTicket 11まで必須にしない。

## Pass condition

静的配信元とAPI実行元を分けても、runtime configでHTTP + polling構成が動けば完了。
