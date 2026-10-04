# 予約の実時刻（start_time / end_time）

2026-09-29 から、予約の実時刻は `reservations.start_time` / `end_time`（`time`, JST）に
保存されている。**表示側は必ずこの列を読む。`time_slot` や日付から時刻を計算してはいけない。**

## なぜ保存するようにしたか

以前は `time_slot`（morning / afternoon / evening / night）だけを保存し、時刻は表示のたびに

1. `daily_time_slots` に明示 active 行があればその `start_time` / `end_time`
2. 無ければ日付・曜日・祝日・ルール開始日（6/6, 8/1）から既定時刻を計算

していた。この計算がフロント・Edge Function 共有モジュール・LINE 関数内のコピペ定数の
複数箇所に重複し、8/1 の平日ルール追加時に LINE 関数だけ取り残されて表示が 1 時間ずれた。

## 仕組み

```
INSERT / UPDATE(date, time_slot) on reservations
  └─ trigger reservations_fill_slot_times (BEFORE)
       ├─ 時刻が明示されていればそのまま
       └─ 無ければ resolve_slot_times(date, time_slot)
             ├─ daily_time_slots の明示 active 行
             └─ default_slot_times(date, time_slot)   ← 既定ルール（jp_holidays で祝日判定）
```

| 対象 | 場所 |
| --- | --- |
| 既定ルール（サーバ側の正） | DB 関数 `public.default_slot_times(date, time_slot)` |
| 明示行 → 既定 の解決 | DB 関数 `public.resolve_slot_times(date, time_slot)` |
| 作成・変更時の確定 | トリガー `reservations_fill_slot_times` |
| 祝日 | テーブル `public.jp_holidays`（2024〜2030。**2031 年以降を受け付ける前に追加する**） |
| 予約前のプレビュー・空き判定（フロント） | `src/utils/timeSlotRules.ts`（DB 関数と同じルール。変更時は両方を直す） |
| 表示ヘルパ | `src/utils/reservationTime.ts` / `supabase/functions/_shared/reservation-time.ts` |

既定ルール（両方で同一に保つこと）:

| 適用日 | morning | afternoon | evening | night |
| --- | --- | --- | --- | --- |
| 土日祝 2026-06-06〜 / 平日 2026-08-01〜 | 10:00-12:30 | 13:00-15:30 | 16:00-18:30 | 19:00-21:30 |
| それ以前 | 10:00-12:30 | 13:30-16:00 | 17:00-19:30 | 20:00-22:30 |

## 運用上の意味

- 予約の時刻は**作成時点で確定**する。後から `daily_time_slots` を変えても既存予約の時刻は
  変わらない（以前は表示が勝手に変わっていた）。既存予約の時刻を変えたい場合は予約側を編集する。
- 管理画面で予約の日付や枠を変更すると、トリガーがその日の明示行／既定ルールで時刻を引き直す。
  `start_time` / `end_time` を同時に指定した場合はその値が優先される。
- 新しいルール（例: 特定日から時刻を変える）を入れるときは
  1. `default_slot_times()` を更新するマイグレーション
  2. `src/utils/timeSlotRules.ts` の同じ変更（プレビュー用）
  の両方を行う。既存予約はそのまま（過去の合意時刻を保つ）。
- `daily_time_slots` に `daily_time_slots_canonical_times` CHECK（NOT VALID）があり、新規行は
  上表の時刻に限定される。過去の非正準行（2025-09〜12 の 15:00-17:30 など）はそのまま予約に
  反映されている。

## 読み側の一覧（2026-09-29 時点）

- フロント: `ReservationInfo`（予約詳細）、`AdminUpcomingReservations`、`AdminSearchResults`
- Edge Functions: `send-pending-notification`、`send-confirmation-notification`、
  `send-reservation-reminders`、`get-reservation-by-code`、`line-staff-webhook`、`line-staff-daily-push`
- `ReservationConfirmDialog` / `TimeSlotSelect` / `AdminCalendar` の行ヘッダ /
  `ReservationTimeSelect` は「これから選ぶ枠」のプレビューなので `timeSlotRules.ts` を使う。
