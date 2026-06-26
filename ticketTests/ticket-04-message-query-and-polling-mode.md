# Ticket 04 Test Cases: Message Query And Polling Mode

## Goal under test

WebSocket移行前でもAWS上でチャットとして使えるように、HTTP差分取得を用意する。

## Automated tests

1. `GET /api/messages/:spaceId` が従来通り全件取得できる。
2. `GET /api/messages/:spaceId?since=<timestamp>` が `since` より新しいメッセージだけ返す。
3. `since` と同時刻のメッセージを重複取得しないための境界条件が定義されている。
   - 推奨: `timestamp > since`
   - 同一timestampの可能性がある場合は `cursor = timestamp#messageId` を検討する。
4. 期限切れメッセージは全件取得でも差分取得でも返らない。
5. invalidな `since` は400か、安全なfallbackとして扱われる。
6. polling modeは同じmessage idを重複表示しない。

## Integration tests

1. Socket.IOを無効化、または接続しない状態で、2つのブラウザ相当クライアントが数秒pollingでメッセージを同期できる。
2. メッセージ投稿後、次回pollingで相手側に表示される。
3. 期限切れ後、polling結果から対象メッセージが消える。

## Manual checks

1. polling中にUIが過度にちらつかない。
2. 既存Socket.IOが有効なローカル環境でも、polling追加により二重表示されない。

## Non-goals

- リアルタイム性の完成度は含めない。
- WebSocket reconnectやpresence精度は含めない。
- ページングUIや無限スクロールは含めない。

## Pass condition

Socket.IOなしでも、HTTP取得だけで新規メッセージ同期と期限切れ非表示が成立すれば完了。
