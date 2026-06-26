# Ticket Test Cases

このディレクトリは、`docs/aws-serverless-migration-tickets.md` の各チケットを完了判定するためのテストケースを管理する。

各ファイルは次の観点で構成する。

- `Goal under test`: チケットのGoalを短く再掲する。
- `Automated tests`: Jest、ユニットテスト、ローカル統合テストとして自動化したい項目。
- `Integration tests`: ローカルサーバ、Lambda handler、AWS互換モック、または実AWS許可後に確認する項目。
- `Manual checks`: UIや運用手順など、人間が最後に見る項目。
- `Non-goals`: そのチケットでは完了判定に含めない項目。

## Ticket Files

- [Ticket 01: Baseline Safety And Test Alignment](ticket-01-baseline-safety-and-test-alignment.md)
- [Ticket 02: Passphrase Contract And Space Identity](ticket-02-passphrase-contract-and-space-identity.md)
- [Ticket 03: Storage And File Abstractions For Local Runtime](ticket-03-storage-and-file-abstractions-for-local-runtime.md)
- [Ticket 04: Message Query And Polling Mode](ticket-04-message-query-and-polling-mode.md)
- [Ticket 05: DynamoDB Storage Implementation](ticket-05-dynamodb-storage-implementation.md)
- [Ticket 06: S3 File Storage And Presigned URLs](ticket-06-s3-file-storage-and-presigned-urls.md)
- [Ticket 07: Lambda HTTP Handlers And API Gateway Shape](ticket-07-lambda-http-handlers-and-api-gateway-shape.md)
- [Ticket 08: Static Hosting And Runtime Config](ticket-08-static-hosting-and-runtime-config.md)
- [Ticket 09: Archived / Not Planned Data Migration](ticket-09-data-migration-plan-and-scripts.md)
- [Ticket 10: AWS Infrastructure, Cost Guards, And Deployment](ticket-10-aws-infrastructure-cost-guards-and-deployment.md)
- [Ticket 11: API Gateway WebSocket Migration](ticket-11-api-gateway-websocket-migration.md)
- [Ticket 12: Final Cutover And Raspberry Pi Decommission Plan](ticket-12-final-cutover-and-raspberry-pi-decommission-plan.md)

## Cross-ticket Rules

- 外部AWS環境への実デプロイ、DNS切替、S3実アップロードなどは、ユーザーの明示許可がある場合だけ実行する。
- サーバ側が平文メッセージや平文合言葉を扱わないことを、関連チケットの回帰テストに含める。
- `DynamoDB TTL` と `S3 Lifecycle` は物理削除、API側期限判定は論理削除として別々に検証する。
- WebSocketが未実装の段階では、HTTP + pollingで最低限のチャット成立を完了判定にする。
