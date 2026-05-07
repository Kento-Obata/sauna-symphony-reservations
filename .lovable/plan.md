# 1日4枠対応プラン（確定版）

## ゴール
予約の時間帯に4つ目の枠（`night`）を追加。**4枠目を有効化した日のみ**4枠表示、それ以外の日は現状の3枠UIを完全維持。

## 大原則（既存サイトへの非破壊保証）
- `TIME_SLOTS` 定数（公開UIで使用）には **night を追加しない**。デフォルト時間は別マップ `OPTIONAL_TIME_SLOTS` に分離
- 表示判定は **`daily_time_slots` を真とする**：該当日に `time_slot='night'` の有効レコードが無い限り、UIに4枠目は一切現れない
- 結果：night パターン未適用の既存日 = 完全に現状のまま

---

## 影響範囲

### Index（公開）
- `src/types/reservation.ts` — `TimeSlot` に `"night"` 追加
- `src/components/TimeSlotSelect.tsx` — 表示候補を `[morning, afternoon, evening]` 固定 + 「該当日に night の有効 daily_time_slot がある場合のみ night を追加」
- `src/utils/availabilityUtils.ts` — `getAvailableTimeSlotsForDate` を「daily_time_slots 参照ベース」に修正（既知の弱点修正も兼ねる）
- `src/components/reservation/ReservationCalendar.tsx`, `ReservationInfo.tsx`, `ReservationDetails.tsx` — TimeSlot 型拡張に追従
- `src/components/ReservationForm.tsx`, `ReservationConfirmDialog.tsx`, `src/hooks/useReservationForm.ts`, `useReservations.ts` — 型追従のみ

### Admin
- `src/components/admin/AdminCalendar.tsx` — 行レンダリングを「3固定行 + night 有効日のみ4行目セル描画」に変更
- `src/components/admin/AdminReservationDialog.tsx` — `timeSlotReservations` 初期値に `night: 0` 追加
- `src/components/admin/AdminReservationDetailsDialog.tsx`, `reservation-details/ReservationTimeSelect.tsx` — 型追従
- `src/components/admin/AdminUpcomingReservations.tsx`, `AdminSearchResults.tsx` — ラベル変換に「夜」追加
- `src/components/admin/DailyTimeSlotDialog.tsx` — Select 選択肢に night、デフォルト時間マップ追加
- `src/components/admin/DailyTimeSlotManager.tsx` — `getTimeSlotLabel` に night
- `src/components/admin/TimeSlotPatternDialog.tsx` / `TimeSlotPatternManager.tsx` / `PatternApplyDialog.tsx` — night フィールド（任意・NULLなら未使用）追加
- `src/hooks/useTimeSlotPatterns.ts` — 型に night 追加

### Shift
- `ShiftCalendar.tsx` — 時間グリッド方式で enum 非依存。**影響なし**
- `ShiftRequest.tsx` — `shift_preferences.time_slot`(text) は morning/afternoon/evening 固定で運用継続。**影響なし**（4枠目に対するスタッフ希望は将来別タスク）

### Edge Functions
- `send-reservation-reminders` — 時間帯ラベルマップに `night` フォールバック追加（実値は daily_time_slots 参照）
- `get-availability`, `check-availability`, `create-reservation`, `confirm-reservation`, `send-confirmation-notification`, `send-pending-notification` — enum 値受け入れ確認のみ（基本ノーコード変更）

---

## DB マイグレーション

1. `ALTER TYPE time_slot ADD VALUE 'night';` （単独トランザクションで先に流す）
2. `time_slot_patterns` に `night_start TIME NULL`, `night_end TIME NULL` 追加
3. `set_default_time_slot_times()` トリガーに night 分岐追加（フォールバック 20:00-22:30）

---

## 実装順序

1. DB マイグレーション（enum + パターン列）
2. 型・定数整理（`TimeSlot` 拡張、`TIME_SLOTS` は3枠維持、`OPTIONAL_TIME_SLOTS` 新設）
3. `availabilityUtils.ts` を daily_time_slots 参照に修正
4. Admin 側 UI（パターン Dialog / DailyTimeSlot Dialog / Manager / PatternApply / AdminCalendar）に night 対応
5. 公開 UI（`TimeSlotSelect` を「3固定 + night は有効日のみ」に変更）
6. Edge Function ラベルマップ更新
7. 動作確認：
   - 既存日（daily_time_slots に night 行なし）→ 公開UI/Adminカレンダー共に3枠のみ
   - night パターン適用日 → 4枠目が出現、予約可能、詳細表示・リマインダーOK

## 技術メモ
- `ALTER TYPE ADD VALUE` は同トランザクション内で直後に使用不可 → enum 追加と他DDLを別マイグレーションに分割
- `availabilityUtils.ts` は今回 daily_time_slots を読む必要があるため引数追加が必要（呼び出し側 `AvailabilityTextGenerator` も追従）
