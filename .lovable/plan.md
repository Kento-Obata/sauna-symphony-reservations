## 概要
LINE Messaging APIを使って、スタッフがLINEから予約管理できるBotを構築します。
予約の照会・追加・変更・キャンセルをLINE上でテキストコマンドで操作でき、新規予約やキャンセルが発生した際は許可済みスタッフのLINEへ自動push通知します。

## アーキテクチャ

```text
[LINE App] ──webhook──▶ [Edge: line-webhook] ──┐
                                                ├─▶ Supabase DB (reservations 他)
[create/confirm/cancel-reservation] ─────┐      │
                                          └─▶ [Edge: line-notify-staff] ──push──▶ [LINE App]
```

## DB変更（migration）

新規テーブル `line_allowed_users`:
- `line_user_id` (text, unique) — LINEのuserId
- `display_name` (text) — スタッフ名（メモ用）
- `is_active` (bool, default true)
- `can_write` (bool, default true) — 予約追加/変更/キャンセル権限
- `receive_notifications` (bool, default true) — push通知対象か
- RLS: adminのみ管理可、誰もread不可（service role経由のみ）

## Edge Functions

### 1. `line-webhook`（verify_jwt=false）
- LINE署名検証（`x-line-signature` を `LINE_CHANNEL_SECRET` でHMAC-SHA256）
- userIdが`line_allowed_users.is_active=true`に存在するか確認、なければ「権限がありません」と返信
- テキストコマンドをparseして処理：
  - `ヘルプ` / `help` — コマンド一覧
  - `今日` / `明日` / `YYYY-MM-DD` — その日の予約一覧
  - `照会 [予約コード]` — 詳細
  - `キャンセル [予約コード]` — status='cancelled'に更新
  - `追加 YYYY-MM-DD [morning|afternoon|evening|night] [人数] [名前] [電話]` — 新規作成（既存`create-reservation`ロジックを内部で呼ぶ）
- LINE Reply APIで応答

### 2. `line-notify-staff`
- bodyに `{ event: 'created'|'confirmed'|'cancelled'|'updated', reservation: {...} }` を受ける
- `line_allowed_users` から `receive_notifications=true` のuserIdをすべて取得
- LINE Push APIで一括送信（multicast）
- service role keyのみ使用、verify_jwt=true

### 3. 既存関数の改修
以下から`line-notify-staff`をfire-and-forget invokeする：
- `create-reservation` — created
- `confirm-reservation` — confirmed
- `cancel-reservation` — cancelled
- `send-update-notification` — updated

## 管理画面

`src/pages/Admin.tsx` に「LINE連携」タブを追加し、`LineUserManager.tsx` で：
- 許可ユーザー一覧表示
- 追加（line_user_id手入力 + 名前）
- 通知ON/OFF・書き込み権限・有効/無効のトグル
- 削除
- Webhook URL表示（コピー可能）

## 必要なシークレット

- `LINE_CHANNEL_ACCESS_TOKEN` — Messaging APIのchannel access token (long-lived)
- `LINE_CHANNEL_SECRET` — Webhook署名検証用

ユーザーへの案内:
1. [LINE Developers](https://developers.line.biz/console/) でMessaging APIチャネルを作成
2. 「Messaging API設定」タブで「Channel access token (long-lived)」を発行
3. 「Basic settings」の「Channel secret」を確認
4. Webhook URLに `https://knjbxqiyngztylnzxzln.supabase.co/functions/v1/line-webhook` を設定し「Use webhook」をON
5. 「応答メッセージ」をOFF、「あいさつメッセージ」は任意

## セキュリティ

- LINE署名検証は必須（未検証リクエストは401）
- 全コマンドで `line_allowed_users` 照合
- 書き込み系コマンド（追加/キャンセル）は `can_write=true` のみ許可
- 個人情報（電話、メール）は照会レスポンスに含めるが、許可済みスタッフのみアクセス可
- 入力バリデーション（日付形式、人数range、コマンド長制限）

## 実装順序

1. migration（`line_allowed_users`テーブル + RLS）
2. シークレット2つ追加
3. `line-notify-staff` edge function
4. `line-webhook` edge function
5. 既存4つの予約関数にnotify呼び出し追加
6. 管理UI（`LineUserManager.tsx` + Adminタブ追加）

## 想定外スコープ（今回はやらない）

- リッチメニュー設定（テンプレでヘルプメッセージ案内のみ）
- Flex Message装飾（プレーンテキストで十分）
- 予約日時の変更（複雑なため、まずキャンセル→再追加で運用）
- 公開向けの顧客用Bot
