# Ticket 02 Test Cases: Passphrase Contract And Space Identity

## Goal under test

合言葉をサーバ側に平文保存しないAPI契約へ移行する。

## Automated tests

1. `normalizePassphrase` が既存仕様に近い `trim()` を行う。
   - `" secret "` と `"secret"` が同じ入力として扱われる。
   - 空文字と空白のみはinvalidになる。
2. `passphraseHash` が `APP_SECRET` と正規化済み合言葉から安定して生成される。
   - 同じsecretと合言葉では同じhashになる。
   - secretが違えばhashが変わる。
   - 元の合言葉文字列がhashに含まれない。
3. 空間作成時、storeへ保存される値に平文 `passphrase` が含まれない。
4. 空間入室時、検索キーが平文 `passphrase` ではなく `passphraseHash` である。
5. `/api/spaces/create` と `/api/spaces/enter` のレスポンスに平文 `passphrase` が含まれない。
6. フロントの暗号鍵生成は、APIレスポンスではなくユーザー入力の合言葉を使う。

## Integration tests

1. ローカルSQLite実装で、同じ合言葉の空間を作成して入室できる。
2. 先頭末尾に空白がある合言葉で、作成時と入室時の挙動が一致する。
3. サーバ再起動後も、hash保存された空間へ同じ合言葉で入室できる。
4. DBファイルを直接確認し、平文合言葉が保存されていないことを確認する。

## Manual checks

1. UIのヘッダー表示など、`currentSpace.passphrase` に依存していた箇所が壊れていない。
2. 合言葉表示機能を残す場合、表示元がAPIレスポンスではなくクライアント保持値になっている。

## Non-goals

- 既存本番DBの移行は含めない。
- `APP_SECRET` のAWS上の最終保管場所は含めない。
- Unicode NFKC正規化など、互換性に影響する正規化変更は含めない。

## Pass condition

サーバ保存、APIレスポンス、ログのいずれにも平文合言葉が残らず、既存の入室と暗号化体験が維持されていれば完了。
