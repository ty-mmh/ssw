# Ticket 11 Test Cases: API Gateway WebSocket Migration

## Goal under test

Socket.IO常駐サーバ依存をなくし、API Gateway WebSocketでリアルタイム通知と公開鍵中継を行う。

## Automated tests

1. `$connect` handlerがconnectionを保存できる。
2. `joinSpace` actionがconnectionに `spaceId` と `sessionId` を紐づけられる。
3. `newMessage` actionが同じspaceの他connectionへmessageを配信する。
4. `publicKeyAnnouncement` actionが同じspaceの他connectionへpublic keyを配信する。
5. `$disconnect` handlerがconnectionを削除できる。
6. `postToConnection` がGone相当のエラーを返した場合、該当connectionを掃除する。
7. connection TTLが保存される。
8. `sessionId = connectionId` の前提で、フロントのSessionManagerが動く。
9. Socket.IO client scriptに依存しないWebSocket client moduleのテストが通る。

## Integration tests

1. WebSocket API mock、local emulator、またはユーザー許可後のdev stageで、2クライアントが同じspaceへjoinできる。
2. クライアントAのmessageがクライアントBへ届く。
3. クライアントAのpublic key announcementがクライアントBへ届く。
4. 切断後、presence/session countが最終的に更新される。
5. 再接続時、新しいsessionとしてjoinし直せる。
6. 画像、音声はWebSocket payloadではなくS3/HTTP参照として扱われる。

## Manual checks

1. 10分idleや2時間接続上限を前提に、フロントが再接続できる。
2. 切断直後のpresence不一致が、体験上許容できる範囲か確認する。
3. hybrid暗号化が失敗してもdeterministic fallbackで読める。
4. Socket.IO importや `/socket.io/socket.io.js` 依存が残っていない。

## Non-goals

- presenceの完全な正確性は保証しない。
- binary mediaのWebSocket送信は含めない。
- HTTP + polling fallbackを削除する必要はない。

## Pass condition

Socket.IOなしでjoin、message broadcast、public key中継、再接続が動き、切断済みconnectionが掃除されれば完了。
