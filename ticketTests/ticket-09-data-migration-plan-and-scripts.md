# Ticket 09 Test Cases: Archived / Not Planned Data Migration

## Goal under test

既存Raspberry Pi上のSQLite DBとuploadsはAWSへ移行しない。AWS版はclean DynamoDB/S3で開始する。

## Automated tests

1. Ticket 09が Archived / Not Planned として記録されている。
2. AWS版の必須テストや完了条件が、既存DB移行の実行を要求していない。
3. migration scriptが残る場合も、実運用ロードマップの必須成果物として扱われていない。

## Integration tests

1. AWS dev/staging検証は、新規spaceと新規messageで実施できる。
2. clean DynamoDB/S3前提でも、Ticket 10-12の検証手順が成立する。

## Manual checks

1. 切替前にRaspberry Pi側の `secure_chat.db` と `public/uploads` をバックアップまたは予備確認用として扱う判断が残っている。
2. 既存DB移行を行わない方針が切替手順の前提と矛盾していない。

## Non-goals

- migration scriptの完成、dry-run、DynamoDB/S3への既存データ投入は含めない。
- 既存passphraseとAWS `APP_SECRET` の互換性確保は含めない。
- DNS切替やRaspberry Pi停止は含めない。

## Pass condition

Ticket 09が実運用パスに含まれないことが明記され、AWS版をclean DynamoDB/S3で開始する前提が他チケットと矛盾しなければ完了。
