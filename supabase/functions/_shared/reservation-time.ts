// 予約の実時刻 (reservations.start_time / end_time) の表示ヘルパ。
//
// 予約の時刻は作成時に DB トリガー (reservations_fill_slot_times) が確定して行に保存される。
// 表示側では time_slot や日付から時刻を計算してはいけない。必ずこの列を読む。
// 既定ルールそのものは DB 関数 public.default_slot_times() にある。

/** Postgres の time ("16:00:00") → "16:00" */
export const toHHMM = (t: string | null | undefined): string => (t ? String(t).slice(0, 5) : "");

/** "16:00:00", "18:30:00" → "16:00-18:30"。欠損時は "" */
export const formatReservationTime = (
  r: { start_time?: string | null; end_time?: string | null },
): string => {
  const s = toHHMM(r.start_time);
  const e = toHHMM(r.end_time);
  return s && e ? `${s}-${e}` : "";
};

/** 予約コードから "HH:MM-HH:MM" を取得（通知関数用。行が無ければ ""）。 */
// deno-lint-ignore no-explicit-any
export const fetchReservationTimeLabel = async (sql: any, reservationCode: string): Promise<string> => {
  const rows = await sql`
    select start_time::text, end_time::text
    from public.reservations
    where reservation_code = ${reservationCode}
    limit 1
  `;
  return rows[0] ? formatReservationTime(rows[0]) : "";
};
