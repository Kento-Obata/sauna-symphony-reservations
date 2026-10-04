// 予約の実時刻 (reservations.start_time / end_time) の表示ヘルパ。
//
// 予約の時刻は作成時に DB トリガー (reservations_fill_slot_times) が確定して行に保存される。
// 予約の表示で time_slot や日付から時刻を計算してはいけない（timeSlotRules.ts は
// 「これから予約する枠」のプレビュー・空き判定専用）。

/** Postgres の time ("16:00:00") → "16:00" */
export const toHHMM = (t: string | null | undefined): string => (t ? String(t).slice(0, 5) : "");

/** "16:00:00", "18:30:00" → "16:00-18:30"。欠損時は "" */
export const formatReservationTime = (r: {
  start_time?: string | null;
  end_time?: string | null;
}): string => {
  const s = toHHMM(r.start_time);
  const e = toHHMM(r.end_time);
  return s && e ? `${s}-${e}` : "";
};
