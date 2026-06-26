# Ticket 06 Test Cases: S3 File Storage And Presigned URLs

## Goal under test

ローカル `public/uploads` 依存を外し、暗号化済みファイルをS3へ保存できるようにする。

## Automated tests

1. S3 `FileStore` がupload用presigned requestを生成できる。
2. presigned responseに平文ファイル内容や暗号鍵が含まれない。
3. メッセージ保存時、DBには期限付きURLではなく `storageKey` または `s3Key` が保存される。
4. download用presigned URLは必要時に都度生成される。
5. object keyが推測しにくい構造になっている。
   - `spaceId`
   - `messageId`
   - random component
6. media metadataは復号表示に必要な最小限だけ保存される。
7. `FILE_DRIVER=local` と `FILE_DRIVER=s3` を切り替えられる。

## Integration tests

1. S3 mock、LocalStack、またはAWS許可後の実S3で、presigned uploadからdownloadまで通る。
2. ブラウザ相当の処理で暗号化済みBlobをuploadし、download後に復号できる。
3. 画像メッセージが表示できる。
4. 音声メッセージが再生できる。
5. 期限切れURLをDBに保存していないため、再取得時に新しいdownload URLを発行できる。

## Manual checks

1. S3 object keyやmetadataに平文合言葉、平文メッセージ、元ファイルの不要な情報が入っていない。
2. uploadサイズ上限がUI、API、presigned条件のどこで担保されるか確認する。
3. WebSocket経由でbinaryを送る実装になっていないことを確認する。

## Non-goals

- S3 Lifecycleの本番設定は含めない。
- CloudFront private distributionによる配信は含めない。
- 本番S3への実アップロードは明示許可なしに行わない。

## Pass condition

S3 driverで暗号化済みmediaを保存、参照、復号表示でき、DBには永続object keyだけが保存されていれば完了。
