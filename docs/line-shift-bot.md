# スタッフ用 LINE bot（予約照会・シフト操作）

スタッフ LINE チャネル（Messaging API）で動く bot の仕様。実装は
`supabase/functions/line-staff-webhook`（受信）と `line-staff-daily-push`（毎朝の配信）。

## 構成

```
LINE Platform
  │  webhook (POST, X-Line-Signature)          reply API (無料・replyToken 1回限り)
  ▼                                             ▲
line-staff-webhook ──────────────────────────────┘
  │  _shared/line.ts        署名検証 / reply / push
  │  _shared/shift-bot.ts   コマンド解釈・整形（純粋関数, deno test あり）
  │  _shared/shift-service.ts  DB 操作（POSTGRES_URL 直結）
  │  _shared/time-slot-rules.ts 予約枠の既定時刻（フロントと同一ルール）
  ▼
Postgres: shifts / profiles / staff_line_users / reservations / daily_time_slots

pg_cron (毎日 23:00 UTC = 08:00 JST)
  └─ line-staff-daily-push ── push API ──▶ スタッフグループ (STAFF_PUSH_GROUP_ID)
```

- **reply** は webhook で受けたメッセージへの返信。通数課金の対象外。
- **push** は bot 側から任意のタイミングで送る。日次配信と、シフト変更の周知に使う。
  1:1 トークでシフトを変更した場合はグループへ push、グループ内で変更した場合は reply が
  そのままグループに届くので push しない（二重通知防止）。
- 認識できないテキストには一切返信しない（グループの雑談に反応させないため）。

## 認証・権限

| 層 | 仕組み |
| --- | --- |
| webhook | `X-Line-Signature` を `LINE_CHANNEL_SECRET` で HMAC-SHA256 検証（`verify_jwt = false`） |
| 利用者 | `staff_line_users`（`line_user_id`, `is_active`）に登録済みの LINE ユーザーのみ |
| シフト操作の主体 | `staff_line_users.staff_id` → `profiles.id`。未設定ならシフト系コマンド不可 |
| 他人のシフト | `profiles.role = 'admin'` の場合のみ、名前を付けて操作可 |
| 日次配信 | pg_cron から `Authorization: Bearer <CRON_SHARED_SECRET>` |

新しいスタッフを bot に加える手順:

1. スタッフが bot に「ID」と送り、表示された userId を管理者へ伝える
2. `staff_line_users` に行を追加し、`staff_id` にそのスタッフの `profiles.id` を入れる

```sql
insert into staff_line_users (line_user_id, display_name, is_active, staff_id)
values ('Uxxxxxxxx', '表示名', true, '<profiles.id>');
```

## コマンド仕様

入力は全角数字・全角記号・全角スペースを半角に正規化してから解釈する。

### 予約

| 入力 | 動作 |
| --- | --- |
| `今日` / `明日` / `明後日` / `5/25` / `2026-05-25` | その日の予約一覧（confirmed / pending / pending_payment のみ） |
| `R-ABCD1234` / `ABCD1234` | 予約コードで詳細（キャンセル含む） |
| `09012345678` | 電話番号で顧客サマリ＋直近 10 件 |
| `ヘルプ` / `使い方` / `ID` / `groupid` | 補助 |

### シフト

書式: `シフト<動作> [名前] <日付> [開始-終了] [休憩N]`
（`シフト 追加` のように動作の前にスペースがあってもよい）

| 入力 | 動作 |
| --- | --- |
| `シフト` | 今日のシフト（全員） |
| `シフト 明日` / `シフト 10/3` / `シフト 2026-10-03` | 指定日のシフト |
| `シフト 今週` / `シフト 来週` | 月〜日の週間一覧（空の日も表示） |
| `マイシフト` | 自分の今日から 14 日分 |
| `シフト追加 10/3 14:30-22:00 休憩60` | 自分のシフトを追加（休憩は省略可、既定 0） |
| `シフト変更 10/3 15:00-22:00` | その日の自分のシフトを変更（休憩は省略時そのまま） |
| `シフト削除 10/3` | その日の自分のシフトを削除（`status = 'cancelled'`） |
| `シフト追加 稲垣 10/3 14:30-22:00` など | 管理者のみ: 名前を付けて他人を操作 |
| `シフト ヘルプ` | シフトコマンドの説明 |

引数の受け付け形式:

- 日付: `今日` `明日` `明後日` `M/D` `M月D日` `YYYY-MM-DD` `YYYY/M/D`。
  `M/D` は当年扱い、30 日以上過去なら翌年。
- 時刻: `14:30` `14` `1430` `9:00`。範囲区切りは `-` `~` `〜` `～`。
  `14:30 - 22:00` のようにスペースで離れていてもよい。
- 休憩: `休憩60` `休憩60分` `休憩 60`。
- 名前: `profiles.username` に完全一致 → 部分一致（1 件に絞れた場合のみ）。

制約・エラー時の挙動:

- 終了が開始以前 → エラー案内。日またぎシフトは非対応。
- 同じ人の既存シフトと時間が重なる追加・変更は拒否（既存の時間を返信）。
- 変更・削除はその日にシフトが 1 件のときのみ自動で対象を特定する。
  2 件以上ある日は一覧を返し、管理画面での編集を案内する。
- 書式は合っているが解釈できない引数 → `⚠` 付きで例を返す。

### 追加・変更・削除の周知

成功時はスタッフグループへ以下のような push が飛ぶ（操作者名付き）。

```
🔄 シフト変更
稲垣 10/3 (土)
14:30-22:00（休憩60分） → 15:00-22:00（休憩60分）
（小畑 が操作）
```

## 日次配信（line-staff-daily-push）

毎朝 8:00 JST に「本日のシフト」と「本日の予約」をグループへ push する。

```
☀ おはようございます

📅 2026-09-29 (火)

👷 本日のシフト
・リド 14:30-22:00（休憩60分）

🛁 本日の予約 1件

🕐 16:00-18:30｜鷹尾京香 様 1名
  📞 ...
```

動作確認は LINE に送らずに本文だけ取得できる:

```sh
curl -s "https://<project>.supabase.co/functions/v1/line-staff-daily-push?dry_run=1&date=2026-10-03" \
  -H "Authorization: Bearer $CRON_SHARED_SECRET"
```

## 予約枠の表示時刻について

予約の実時刻は `reservations.start_time` / `end_time` に保存されている（作成時に DB トリガーが確定）。
LINE 系関数はこの列をそのまま表示し、`time_slot` や日付から時刻を計算しない。
詳細は `docs/reservation-times.md`。

## デプロイ

`_shared` を相対 import しているため、MCP `deploy_edge_function` で配布する場合は
`line-staff-webhook/index.ts` をエントリポイントにし、`_shared/*.ts` を同梱する。
どちらの関数も `verify_jwt = false`（webhook は署名検証、日次配信は共有シークレットで認証）。

テスト: `deno test supabase/functions/_shared/`
