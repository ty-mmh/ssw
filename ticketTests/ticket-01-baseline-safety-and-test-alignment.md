# Ticket 01 Test Cases: Baseline Safety And Test Alignment

## Goal under test

移行前の足場を整え、リファクタ時に壊れた箇所を検知できる状態にする。

## Automated tests

1. `npm test` が全件成功する。
2. API moduleのテストが実コードの公開API名と一致している。
   - `sendMessageFriendly` は実際の暗号化関数をmockする。
   - 存在しない関数名を期待しない。
3. `/api/messages/create` 相当の処理を呼び出しても、`console.log` に次の値が含まれない。
   - 平文message
   - `encryptedPayload`
   - `metadata.name`
   - request body全体のJSON
4. ログが必要な場合でも、出力されるのは次のような低感度情報だけである。
   - `messageId`
   - `spaceId`
   - `messageType`
   - 処理結果
5. Lintまたは構文チェックが成功する。

## Integration tests

1. ローカルDB初期化後、Expressサーバで空間作成、入室、メッセージ投稿、メッセージ取得ができる。
2. 画像または音声以外の通常テキストメッセージ投稿が既存UIから動く。
3. エラー時のJSON形式が既存クライアントで扱える形式のまま維持される。

## Manual checks

1. 開発者コンソールとサーバログを見て、message payloadや合言葉が表示されていないことを確認する。
2. 既存のローカル起動手順が変わった場合、READMEまたは関連メモに追記されていることを確認する。

## Non-goals

- passphrase hash化の完了判定は含めない。
- DynamoDB、S3、Lambdaの動作確認は含めない。
- UI改善は含めない。

## Pass condition

自動テストが通り、ローカルの主要フローが動き、機微情報ログが出ないことを確認できたら完了。
