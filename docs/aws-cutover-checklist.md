# AWS Cutover Checklist

このチェックリストは、AWS版を検証してから Raspberry Pi / Cloudflare Tunnel 依存を外すための手順である。実DNS切替、外部公開、Raspberry Pi停止はユーザーの明示許可後に行う。

## Pre-cutover

- AWS dev/staging URLで空間作成、入室、テキスト投稿、履歴取得が通る。
- 画像と音声のupload/download/復号表示が通る。
- 期限切れメッセージがAPIとUIで非表示になる。
- WebSocket版まで進んでいる場合、join、message broadcast、public key announcement、再接続が通る。
- HTTP polling fallbackが残っている場合、WebSocket unavailable時にも同期できる。
- Budgetまたはbilling alarmの通知先が確認済み。
- S3 LifecycleとDynamoDB TTLが有効。

## DNS Switch

- 低コスト優先のため、DNSはCloudflare継続を基本とする。
- CloudFront distribution domainを検証する。
- 既存Cloudflare Tunnelの向き先を変更する前に、Raspberry Pi版の最終バックアップを取得する。
- DNS切替はユーザーが明示許可したタイミングで行う。

## Rollback

- DNSを旧Cloudflare Tunnel向きに戻す。
- AWS版への書き込み期間がある場合、その間のメッセージ差分を確認する。
- 問題が解消するまでRaspberry Pi版を停止しない。

## Raspberry Pi Decommission

- 切替後、一定期間はRaspberry Pi版を予備として残す。
- 停止前に `secure_chat.db` と `public/uploads` のバックアップを保存する。
- 停止後もAWS版の主要ユースケースとBudget通知を再確認する。
