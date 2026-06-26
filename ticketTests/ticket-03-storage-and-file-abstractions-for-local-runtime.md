# Ticket 03 Test Cases: Storage And File Abstractions For Local Runtime

## Goal under test

SQLite、local upload、process memory への直依存を薄い抽象層へ移す。

## Automated tests

1. `SpaceStore` のlocal実装が次を満たす。
   - 空間を作成できる。
   - 合言葉hashで空間を取得できる。
   - 重複作成を拒否できる。
   - `lastActivityAt` を更新できる。
2. `MessageStore` のlocal実装が次を満たす。
   - メッセージを作成できる。
   - `spaceId` 単位でtimestamp昇順に取得できる。
   - 期限切れメッセージを除外できる。
3. `FileStore` のlocal実装が次を満たす。
   - ファイル保存用の結果を返せる。
   - 既存の `/uploads/...` 相当の参照を維持できる。
4. 主要ルートのテストが、直接DBオブジェクトではなくstore境界をmockして通る。
5. `server.js` やroute moduleに `new Database(...)` などの直初期化が残る場合でも、アプリ起動境界に限定されている。

## Integration tests

1. local driverで、空間作成、入室、テキスト投稿、履歴取得が動く。
2. local file driverで、暗号化済み画像または音声を保存し、取得できる。
3. 既存Socket.IO flowが壊れていない。

## Manual checks

1. 後続のDynamoDB/S3 driverを追加する時、既存routeの大きな改修が不要な形になっていることをコードレビューする。
2. 抽象化が過剰になっていないことを確認する。

## Non-goals

- DynamoDB/S3実装は含めない。
- Socket.IOの置き換えは含めない。
- DBスキーマの大きな変更は含めない。

## Pass condition

local runtimeが既存通り動き、HTTP API主要処理がstore境界越しにデータアクセスしていれば完了。
