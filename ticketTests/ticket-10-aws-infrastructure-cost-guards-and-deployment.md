# Ticket 10 Test Cases: AWS Infrastructure, Cost Guards, And Deployment

## Goal under test

サーバレス実行環境をIaCで作り、コスト事故を避ける最低限のガードを入れる。

## Automated tests

1. IaC synthまたはtemplate validationが成功する。
2. templateに次のリソースが含まれる。
   - API Gateway HTTP API
   - Lambda
   - DynamoDB tables
   - S3 bucket
   - CloudFront distribution
3. Lambda roleのIAM権限が対象table/bucket/prefixに限定されている。
4. `APP_SECRET` などの機密値がtemplate、source、snapshotに平文で含まれない。
5. DynamoDB TTLが有効化されている。
6. S3 Lifecycle ruleが定義されている。
7. Budgetまたはbilling alarmの設定、または手順が存在する。
8. destructiveな本番削除設定が初期値になっていない。

## Integration tests

1. ユーザー許可後にdev stageへdeployし、HTTP API smoke testが通る。
2. dev stageでLambdaがDynamoDB/S3へ必要最小限の操作を実行できる。
3. CORSとCloudFront `/api/*` routingが想定通り動く。
4. TTL/Lifecycleは設定が存在することを確認する。実際の削除完了までは待たない。

## Manual checks

1. AWSアカウント、region、stage名が意図したものか確認する。
2. Budget/billing alarmの通知先をユーザーが確認する。
3. Route 53を使わずCloudflare DNSを継続する場合、その前提が手順に残っている。
4. 実デプロイはユーザーの明示許可後だけ行う。

## Non-goals

- WebSocket infrastructureはTicket 11で扱う。
- 本番DNS切替は含めない。
- 無料枠内保証はしない。

## Pass condition

IaCで必要リソースとコストガードを再現でき、明示許可後のdev deployでHTTP smoke testが通れば完了。
