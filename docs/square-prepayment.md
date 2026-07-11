# Square 事前決済(イベント予約・貸切予約)

## 貸切予約の事前決済(お客様が選択)

貸切予約はフォームで支払い方法を選択できる:
- **現地払い**(既定): 従来どおり 仮予約 → メール/SMS リンクで確定(2時間) → 当日支払い
- **オンライン事前決済**: `pending_payment` で枠を20分ホールド → Square 決済ページ →
  支払い完了(Webhook)で確定。メール確認は不要。確定通知は既存の
  send-confirmation-notification(email任意 + SMS + オーナーSMS + LINE)

要点:
- 冪等キーは `resv-` プレフィックス(`resv-link-` / `resv-cancel-` / `resv-late-refund-`)。
  イベント側と予約コード形式が同じため名前空間分離が必須
- **`cleanup_expired_reservations()` は `payment_method='square_online'` の行を DELETE しない**
  (20260713 マイグレーションで置換済み)。事前決済行を削除すると Square 注文と照合できず
  遅延入金の自動返金が不可能になるため。事前決済の期限切れは `expire-event-holds` が
  `expired` へ遷移させ、行は監査用に保全される
- 枠の排他は `pg_advisory_xact_lock`(date+time_slot)で直列化。confirm-reservation にも
  競合チェックを追加済み(従来の二重予約ギャップを解消)
- キャンセル: お客様は前日まで(決済待ちはいつでも)。支払い済みは自動全額返金。
  管理画面のキャンセルは支払い済みの場合 `admin-cancel-reservation` を経由する。
  **新しい管理画面コードを追加する際、reservations への直接 UPDATE で
  キャンセルすると返金がスキップされるので注意**
- 管理者が支払い済み予約の金額を変更しても差額は自動調整されない(警告トースト表示・手動対応)

---

# イベント予約の Square 事前決済

イベント(`events.payment_type = 'prepaid'`)の予約は、Square のホスト型決済ページで
支払いが完了した時点で確定する。カード情報は自サイトでは一切扱わない。

## フロー概要

```
予約フォーム送信
  → create-event-reservation: pending_payment で20分席を確保 + Square 決済リンク作成
  → お客様を Square 決済ページへリダイレクト
  → 支払い完了
      → square-webhook (payment.updated / COMPLETED) が「正」: 枠を再ロック・再集計して確定
      → 併走: 詳細ページ(?from=checkout)が 3秒毎ポーリング + verifyPayment バックストップ
  → 確定メール(事前決済済み表記) + LINE 通知
```

- 期限(20分)切れ: 集計から自動で外れて席が解放される。`expire-event-holds`(cron 5分毎)が
  `expired` へ遷移させ、決済リンクを削除して遅延入金の窓を閉じる
- 期限切れ後・キャンセル後に支払われた場合: webhook が自動で全額返金し、顧客へメール +
  オーナーへ LINE 警告を送る
- 自己キャンセル/管理者キャンセル: 支払い済みなら Refunds API で全額自動返金
  (`payment_status='refunded'`)。**返金時、Square の決済手数料(約3.3%)は店側に戻らない**

## 環境変数(Supabase secrets)

| 変数 | 内容 |
|---|---|
| `SQUARE_ACCESS_TOKEN` | アクセストークン(本番/サンドボックスで別) |
| `SQUARE_LOCATION_ID` | ロケーションID(`GET /v2/locations` で取得) |
| `SQUARE_API_BASE` | サンドボックスは `https://connect.squareupsandbox.com`。未設定なら本番 |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Webhook 購読の署名キー |
| `SQUARE_WEBHOOK_NOTIFICATION_URL` | 任意。既定は `SUPABASE_URL + /functions/v1/square-webhook` |
| `APP_BASE_URL` | 任意。メール・リダイレクトのリンク先(staging 検証時は `http://localhost:5199`) |

設定例(トークン等は各自の値に置換して自分のターミナルで実行):

```bash
# ステージング(サンドボックス)
supabase secrets set --project-ref ycpcwtxpqehjbjiydbbc \
  SQUARE_ACCESS_TOKEN=<sandbox access token> \
  SQUARE_LOCATION_ID=<sandbox location id> \
  SQUARE_WEBHOOK_SIGNATURE_KEY=<sandbox webhook signature key> \
  SQUARE_API_BASE=https://connect.squareupsandbox.com \
  APP_BASE_URL=http://localhost:5199

# 本番
supabase secrets set --project-ref knjbxqiyngztylnzxzln \
  SQUARE_ACCESS_TOKEN=<production access token> \
  SQUARE_LOCATION_ID=<production location id> \
  SQUARE_WEBHOOK_SIGNATURE_KEY=<production webhook signature key>
```

## Square Developer Console での設定(手動・1回だけ)

1. https://developer.squareup.com/apps でアプリケーションを作成(済)
2. **アクセストークン**: Credentials ページで Sandbox / Production それぞれ取得
3. **ロケーションID**: 以下で取得(それぞれの環境で実行)
   ```bash
   curl https://connect.squareupsandbox.com/v2/locations \
     -H "Square-Version: 2026-05-20" -H "Authorization: Bearer <token>"
   ```
4. **Webhook 購読を2つ登録**(Webhooks → Add subscription):
   - Sandbox: URL `https://ycpcwtxpqehjbjiydbbc.supabase.co/functions/v1/square-webhook`
   - Production: URL `https://knjbxqiyngztylnzxzln.supabase.co/functions/v1/square-webhook`
   - どちらも API version `2026-05-20`、イベントは `payment.updated` のみ
   - 登録後に表示される **Signature Key** を対応するプロジェクトの
     `SQUARE_WEBHOOK_SIGNATURE_KEY` に設定(URL は署名対象なので完全一致必須)

## 本番の cron(遅延入金の窓閉じ)

デプロイ後に一度だけ登録(既存 job と同形式。SQL エディタ等で実行):

```sql
select cron.schedule('expire-event-holds', '*/5 * * * *', $$
  select net.http_post(
    url:='https://knjbxqiyngztylnzxzln.supabase.co/functions/v1/expire-event-holds',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer <anon key>"}'::jsonb
  ) as request_id;
$$);
```

ステージングには pg_cron/pg_net が無いため、検証時は curl で直接叩く:
`curl -X POST https://ycpcwtxpqehjbjiydbbc.supabase.co/functions/v1/expire-event-holds`

## サンドボックスのテストカード

CVV 111・有効期限は未来なら任意:
- Visa `4111 1111 1111 1111` / Mastercard `5105 1051 0510 5100`
- JCB `3569 9900 1009 5841`(日本の 3DS チャレンジの確認に使う)

## 冪等性・障害時の挙動(実装メモ)

- Webhook 再送(最大11回/24h): 確定は行ロック + 状態チェックで冪等。メールは Resend の
  Idempotency-Key、返金は固定 idempotency key(`event-cancel-<code>` / `late-refund-<code>`)
- 返金 API 失敗: 自己/管理者キャンセルは 500 で confirmed のまま(電話案内)。webhook の
  自動返金は 500 で Square の再送に乗せ、失敗が続くと LINE 警告が繰り返し届く
  → Square ダッシュボードから手動返金する
- Webhook 未登録/不達: 決済後のポーリング(verifyPayment)がサーバ経由で Square に注文
  状態を照会して自己修復する
