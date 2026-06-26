# Ticket 05 Test Cases: DynamoDB Storage Implementation

## Goal under test

HTTP API が DynamoDB を永続化先として使えるようにする。

## Automated tests

1. DynamoDB `SpaceStore` が `passphraseHash` を一意キーとして空間を作成できる。
2. 同じ `passphraseHash` の同時作成を条件付き書き込みで拒否できる。
3. 空間入室は `passphraseHash` で取得できる。
4. DynamoDB `MessageStore` が `spaceId` ごとにメッセージをtimestamp昇順で取得できる。
5. `expiresAtEpoch <= now` のメッセージをAPI結果から除外できる。
6. `STORAGE_DRIVER=dynamodb` の時だけDynamoDB実装が選ばれる。
7. `STORAGE_DRIVER=sqlite` または未設定ではlocal実装が選ばれる。
8. AWS SDK clientはテストでmock可能で、実AWSへ接続しない。

## Integration tests

1. DynamoDB Local、LocalStack、またはmock adapterで、spaces create/enter と messages create/list が動く。
2. 条件付き書き込み競合のケースで、片方だけ成功する。
3. `expiresAtEpoch` がTTL属性として保存される。
4. local driverとDynamoDB driverで、APIレスポンスの形が同じである。

## Manual checks

1. single-table designになっておらず、読みやすいtable分割が維持されている。
2. GSIだけに一意性保証を任せていないことをコードレビューする。
3. DynamoDB Streamsなど、このチケット外の非同期処理が入っていない。

## Non-goals

- 本番データ移行は含めない。
- IaCでのテーブル作成は含めない。
- billing modeの最終選択は含めない。

## Pass condition

DynamoDB driverでHTTP API相当のspaces/messages操作が動き、合言葉空間の一意性が条件付き書き込みで守られていれば完了。
