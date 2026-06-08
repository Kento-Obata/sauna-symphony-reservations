## 影響範囲の全枠再精査結果

閾値: 2026-06-06 JST 0時より前に作成 / 日付が 2026-06-06 以降の土日 / afternoon・evening・night / status = confirmed,pending / 当該日に明示的な `daily_time_slots` 行が無い。

| # | 予約コード | 氏名 | 日付(曜) | 枠 | 正しい時間 | 通知された時間(推定) | 備考 |
|---|---|---|---|---|---|---|---|
| 1 | LTK9US1K | 篠崎可愛 | 06-06(土) | afternoon | 13:00-15:30 | **13:30-16:00** | 新規発見 |
| 2 | EV34R5XX | 玉岡奈恵 | 06-06(土) | evening | 16:00-18:30 | **17:00-19:30** | 新規発見 |
| 3 | SP571BND | 森木隆介 | 06-06(土) | night | 19:00-21:30 | **20:00-22:30** | 既知 |
| 4 | 3HITRYRX | 西田怜史 | 06-07(日) | afternoon | 13:00-15:30 | **13:30-16:00** | 新規発見 |
| 5 | 5LBNAYDB | オオゾノマナ | 06-07(日) | evening | 16:00-18:30 | **17:00-19:30** | 新規発見 |
| 6 | FI774PYS | 阿賀華 | 06-07(日) | night | 19:00-21:30 | **20:00-22:30** | 前回「正しい」と言われたのは現状再送時の表示。**初回 pending/confirmation SMS は誤** |
| 7 | YUJQBKXS | 大庭真梨愛 | 06-13(土) | afternoon | 13:00-15:30 | **13:30-16:00** | 今回発見 |
| 8 | X4ADOT14 | 坂井美穂 | 06-13(土) | night | 19:00-21:30 | **20:00-22:30** | 新規発見 |
| 9 | GA8QCY1Q | 金森未歩 | 06-14(日) | evening | 16:00-18:30 | **17:00-19:30** | 新規発見 |
| 10 | 1PSRBGAX | 高橋秀明 | 07-19(日) | night | 19:00-21:30 | **20:00-22:30** | 同上(初回 SMS は誤) |

除外: JXJ5PROT(浦山, 07-11 afternoon) は `daily_time_slots` に明示 13:30-16:00 が登録済(管理者意図的に平日時間で運用)のため通知 = DB 値 = 13:30-16:00 で正しい。07-12 は「休枠」で通知なし。

リマインダー(`send-reservation-reminders`) は前日送信。6/6 分のリマインドは 6/5 送信 = 修正前 = 誤。6/7 以降は修正デプロイ後なので正のはず。これも一覧の "影響あり" 側に統合済み。

→ **訂正連絡が必要なのは 10 件**(うち 1 件 #3、1 件 #7 は既に把握済)。残り **8 件が新規発覚**。

---

## 再発防止: 構造的改善

根本原因は 2 つ重なっている:

1. **JST 日付文字列を `new Date()` に渡して UTC 化されたものを `getUTCDay()` で読む** という素朴な落とし穴。
2. **「時間帯ラベル算出」というドメインロジックがフロント(`src/utils/timeSlotRules.ts`)とサーバ(`supabase/functions/_shared/time-slot-rules.ts`)に二重実装**されていて、片方だけ壊れると画面と通知で食い違う(=今回ユーザが「同じ場所参照してないのおかしい」と指摘した点)。

下記をまとめて実施します。

### A. 影響予約の棚卸し用ビュー / レポート

`/mnt/documents/affected-notifications-2026-06.csv` を即時出力し、訂正連絡時のチェックリストにする(連絡自体はユーザが実施)。

### B. 「時間帯ラベルは DB が唯一の真実」化(構造改善の本丸)

1. **欠けている `daily_time_slots` 行を補完する migration** を一発投入。対象:
   - 2026-06-06 以降の土日祝(日本祝日込み) × morning/afternoon/evening/night の 4 枠
   - 既に明示行がある日付・枠は触らない
   - night も含めて 4 枠 seed することで、明示優先パスに必ず乗せる
2. これにより、フロント・サーバとも `daily_time_slots` を引くだけになり、曜日判定ロジック自体が表示・通知の経路から消える(=矛盾不能になる)。
3. ロジック側はフォールバック扱いに格下げ、未登録日があった場合のみ使う。

### C. 日付/曜日ユーティリティの一本化

- `supabase/functions/_shared/date-jst.ts` を新設し、`getJstDayOfWeek(ymd: string)` を **文字列パースのみ**(Date を経由しない、Zeller の公式)で実装。
- `_shared/time-slot-rules.ts` と `src/utils/timeSlotRules.ts` の曜日判定を全部こちらに置き換え。
- `new Date(ymd)` / `parseISO(ymd).getUTCDay()` / `getDay()` のような曜日判定を `git grep` で禁止できるよう ESLint カスタムルール or `eslint-plugin-no-restricted-syntax` で `getUTCDay`, `getDay` 直呼び禁止(ユーティリティ経由のみ許可)。

### D. テスト

- `supabase/functions/_shared/__tests__/time-slot-rules.test.ts` を Deno test として追加:
  - 2026-06-06(土) night → 19:00-21:30
  - 2026-06-13(土) afternoon → 13:00-15:30
  - 2026-06-14(日) evening → 16:00-18:30
  - 2026-06-05(金) night → 20:00-22:30
  - 2026-07-20(月・海の日 祝日) night → 19:00-21:30(祝日経路)
  - 明示 `daily_time_slots` 行がある日付は DB 値が勝つ
- フロント側にも Vitest で同じケース。

### E. 通知 edge function のラベル算出経路統一

- `send-confirmation-notification` / `send-pending-notification` / `send-reservation-reminders` / `send-update-notification` / `send-expiration-notification` を見直し、**全て `getTimeSlotLabel(supabase, slot, date)` 経由のみ**にする(既に大半は対応済だが update / expiration を再点検)。
- 文字列テンプレート内で `${slot}` を直接埋め込んでいる箇所が無いか grep して潰す。

---

## 技術詳細(参考)

```text
src/utils/timeSlotRules.ts         ─┐
supabase/functions/_shared/         │  同じ「曜日 → 時間表」を 2 箇所で再実装
  time-slot-rules.ts               ─┘
                  ↓ 構造改善後
daily_time_slots (DB)                ←  唯一の真実(B で全土日祝 seed)
  ├ src/utils/timeSlotRules.ts       ←  引くだけ
  └ _shared/time-slot-rules.ts       ←  引くだけ
                  ↓
            date-jst.ts              ←  曜日判定はここだけ (C)
```

---

## 実装順

1. CSV 出力(訂正連絡資料)
2. 補完 migration(`daily_time_slots` seed) ← 即時に通知整合が取れる
3. `date-jst.ts` 新設 + 既存呼び出し置換
4. テスト追加
5. ESLint ルール

実施してよろしいですか?
