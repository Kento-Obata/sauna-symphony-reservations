## 問題

トップページのカレンダーで、土日4枠の日に1件予約が入ると残枠が「2」と表示される（正しくは「3」）。

## 原因

`src/components/ReservationStatus.tsx` で `MAX_RESERVATIONS = 3` がハードコードされている。`ReservationCalendar.tsx` の `isDateDisabled` でも `>= 3` で完売判定している。土日4枠ルール（`shouldApplyDefault4Slot` / 明示的 night 行）が考慮されていない。

## 修正方針

日付ごとの最大枠数を算出して表示・完売判定に使う。

### 変更ファイル

1. **`src/utils/timeSlotRules.ts`**
   - `getMaxSlotsForDate(date, dailyTimeSlots)` を追加。
     - 明示的に `night` の active 行がある、または `shouldApplyDefault4Slot` が true → `4`
     - それ以外 → `3`

2. **`src/components/reservation/ReservationCalendar.tsx`**
   - `useDailyTimeSlots()` を呼び出して `dailyTimeSlots` を取得。
   - `getMaxSlotsForDate(day, dailyTimeSlots)` で各日の最大枠数を算出。
   - `ReservationStatus` に `maxReservations` を渡す。
   - `isDateDisabled` の `>= 3` を `>= getMaxSlotsForDate(day, dailyTimeSlots)` に置き換え。

3. **`src/components/ReservationStatus.tsx`**
   - props に `maxReservations?: number`（デフォルト 3）を追加。
   - 内部の `MAX_RESERVATIONS` 定数を props に置き換え。

これで、平日（3枠）の日は従来どおり、土日4枠の日は「4 - 予約数」が表示され、4件で「×」になる。
