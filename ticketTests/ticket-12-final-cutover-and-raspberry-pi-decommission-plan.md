# Ticket 12 Test Cases: Final Cutover And Raspberry Pi Decommission Plan

## Goal under test

AWS版へ安全に切り替え、Raspberry Pi/Cloudflare Tunnel依存を外す。

## Automated tests

1. production-like configでHTTP smoke testが通る。
2. production-like configでstatic assetの主要ファイルが取得できる。
3. health check、または最低限のconfig endpointが成功する。
4. migration後データがある場合、代表spaceのmessagesを取得できる。
5. IaC/templateの差分に意図しないdestroyが含まれない。

## Integration tests

1. AWS版で次の主要ユースケースが通る。
   - 空間作成
   - 入室
   - テキスト投稿
   - 履歴取得
   - 画像upload/download/復号表示
   - 音声upload/download/復号再生
   - 期限切れ非表示
2. WebSocket完了後であれば、リアルタイムmessageとpublic key中継が通る。
3. polling fallbackが残っている場合、WebSocket unavailable時にも最低限同期できる。
4. DNS切替前の検証用URLで、主要フローが通る。

## Manual checks

1. DNSまたはCloudflare向き先変更手順がある。
2. 切り戻し手順がある。
3. Raspberry Pi版をいつ停止するか、読み取り専用期間を置くかが明記されている。
4. 本番DNS切替はユーザーの明示許可後だけ行う。
5. 切替後にBilling dashboardまたはBudget通知が確認できる。

## Non-goals

- 新機能追加は含めない。
- UIリデザインは含めない。
- 許可なしのDNS変更、外部公開、Raspberry Pi停止は行わない。

## Pass condition

AWS版の主要ユースケース、切替手順、切り戻し手順、コスト監視が確認でき、ユーザー許可後にDNS切替できる状態なら完了。
