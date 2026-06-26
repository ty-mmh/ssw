# Ticket 07 Test Cases: Lambda HTTP Handlers And API Gateway Shape

## Goal under test

Express常駐前提から離れ、HTTP APIをLambdaで実行できる形にする。

## Automated tests

1. Lambda handlerがAPI Gateway HTTP API eventを受け取り、JSON responseを返す。
2. 次のroute相当がhandlerで動く。
   - `GET /api/config`
   - `POST /api/spaces/create`
   - `POST /api/spaces/enter`
   - `GET /api/messages/:spaceId`
   - `POST /api/messages/create`
   - file presign系
3. Express routeとLambda handlerが同じservice/store層を使う。
4. エラーレスポンス形式が既存クライアントで扱える。
5. CORS preflight、または必要なCORS headerが返る。
6. `STORAGE_DRIVER` と `FILE_DRIVER` でAWS/local実装を選べる。
7. handler testが実AWSへ接続せずmockで通る。

## Integration tests

1. local Lambda event fixtureで、空間作成からメッセージ取得まで一連のHTTP flowが通る。
2. local ExpressとLambda handlerの同じ入力に対するレスポンス形が一致する。
3. invalid JSON、missing field、not found、conflictなどの代表エラーが期待statusになる。

## Manual checks

1. Expressをローカル開発用に残していても、ビジネスロジックの二重実装がない。
2. Lambda handler内に長時間常駐やinterval前提の処理がない。
3. 認証基盤など、このチケット外の大きな仕様追加が入っていない。

## Non-goals

- API Gateway WebSocket routeは含めない。
- 実AWSデプロイは含めない。
- Express全廃は含めない。

## Pass condition

Lambda handler単体で主要HTTP APIが動き、Expressと共通のservice/store層を使っていれば完了。
