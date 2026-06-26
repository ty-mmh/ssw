# Ticket 09 Test Cases: Data Migration Plan And Scripts

## Goal under test

必要であれば、既存Raspberry Pi上のSQLite DBとuploadsをAWS側へ移せるようにする。

## Automated tests

1. migration scriptのdry-runが、SQLite DBを読み取り専用で開く。
2. dry-runが次の件数を出す。
   - spaces
   - messages
   - media messages
   - upload files found
   - upload files missing
3. 平文 `passphrase` が `passphraseHash` に変換される。
4. 移行先payloadに平文 `passphrase` が含まれない。
5. `/uploads/...` 参照が `s3Key` 予定値へ変換される。
6. dry-runではDynamoDB/S3へ書き込まない。
7. 破損JSON、missing file、unknown message typeを検出し、サマリに出せる。

## Integration tests

1. fixture SQLite DBとfixture uploadsを使ってdry-runが成功する。
2. mock DynamoDB/S3に対する実行モードで、期待件数が書き込まれる。
3. 移行後のmessagesが既存フロントの復号に必要なpayloadを保持している。
4. 同じ移行を再実行した場合の挙動が定義されている。
   - 推奨: idempotentにskip、または明示的にconflictで止める。

## Manual checks

1. 本番実行前に対象DB pathとuploads pathを人間が確認する手順がある。
2. 実AWSへのuploadは明示許可なしに行わない。
3. rollbackは移行先table/prefix単位で削除できる設計になっている。

## Non-goals

- 実験環境で新規DBを使う場合、このチケットの実行は必須ではない。
- DNS切替やRaspberry Pi停止は含めない。
- 本番データをこのテストで外部送信しない。

## Pass condition

dry-runで移行対象と変換内容が明確になり、mock環境への移行で復号に必要な情報が失われなければ完了。
