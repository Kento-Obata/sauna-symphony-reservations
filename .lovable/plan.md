## ゴール

- **2026-06-06以降の土日祝は、明示設定がなくても自動で4枠（morning / afternoon / evening / night）扱い**
- それより前の日付・平日は従来通り3枠
- 既存予約のある日（特に6/6以降の土日祝で既に予約が入っている日）は変更前のまま3枠で固定

## アプローチ：「デフォルトルール + 過去日ロック」

### 1. 表示ロジックを変更（フロントエンド中心）

`src/utils/availabilityUtils.ts` の `getApplicableSlotsForDate` と `src/components/TimeSlotSelect.tsx` の `hasNight` 判定を以下に変更：

```
hasNight = (
  daily_time_slots に active な night 行がある
) OR (
  date >= 2026-06-06
  AND 土日祝（japanese-holidays 利用）
  AND その日の daily_time_slots に "lock" レコードが無い
)
```

`isWeekendOrHoliday` は既に `src/utils/holidayUtils.ts` に存在するのでそのまま流用。

### 2. 「3枠ロック」用データを準備（一回だけ実行）

ルール導入の瞬間に、**今後ルールに巻き込まれてしまう予約済み日付を保護する**ため：

- 6/6以降の土日祝のうち、`reservations` に `confirmed`/`pending` が存在する日付を抽出
- それらの日付に対し `daily_time_slots` に `morning / afternoon / evening` の3行を `is_active: true` で upsert（night は入れない）
- → 表示ロジックの「daily_time_slots に明示行があれば優先」を活かしてロックする

合わせて、ユーザー提案の**「6/6より前のすべての土日祝も明示3枠でロック」**も同じ機構で一括投入。これで今後の混乱も防げる。

この一括投入は管理画面の `PatternApplyDialog` に「6/6切替を有効化」ボタンを1つ追加して実行（ワンクリック・冪等）。

### 3. 既存の「範囲一括（土日祝）」タブの位置付け

デフォルトルール化により**通常運用ではこのボタンは不要**になる。残すかどうかは要確認だが、当面は残置（特殊期間に明示適用したいケースのため）。

## ロック判定ロジックの注意点

「明示行が無い」を判定する際、現状の `getApplicableSlotsForDate` は morning/afternoon/evening 行の有無を見ていない。今回の判定では **「その日付に何らかの daily_time_slots 行が存在するか」** をフラグにする：

- 何か1行でも明示行がある → 明示設定を尊重（ルール無視）
- 1行も無い → ルール適用（土日祝なら4枠、それ以外3枠）

これにより、ステップ2でロックした日付は自動的にルール対象外になる。

## 影響箇所

| ファイル | 変更内容 |
|---|---|
| `src/utils/availabilityUtils.ts` | `getApplicableSlotsForDate` にルール判定を追加 |
| `src/components/TimeSlotSelect.tsx` | `hasNight` 判定にルール判定を追加 |
| `src/utils/timeSlotRules.ts`（新規） | `shouldApplyDefault4Slot(date, dailyTimeSlots)` を切り出し |
| `src/components/admin/PatternApplyDialog.tsx` | 「ルール有効化（既存予約日を3枠でロック）」ボタンを追加 |
| 管理カレンダー表示系 | 4枠目の表示が増えるので目視確認のみ |

DB スキーマ変更は不要（既存 `daily_time_slots` を使う）。

## 設定値の置き場所

`RULE_DEFAULT_4SLOT_FROM = '2026-06-06'` を `src/utils/timeSlotRules.ts` に定数として置く（将来 admin UI で変更したくなったら DB 化）。

## 動作確認チェックリスト

- 6/5（金）→ 3枠
- 6/6（土）の予約無し → 4枠表示
- 6/6（土）の予約あり日 → ロックされ3枠のまま
- 6/14（日）→ 4枠
- 7/21（祝・海の日）→ 4枠
- 5/30（土・6/6前）→ ロック処理後は3枠
- 既に「土日4枠」パターンを適用済みの日 → 4枠（明示行あり）
