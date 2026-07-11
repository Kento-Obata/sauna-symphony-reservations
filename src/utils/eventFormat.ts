// イベント表示用の日時フォーマット（フロント側）。
// edge function 側の _shared/event-format.ts と同じ表記に揃える。

const DOW_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

/** "2026-08-01" → "2026年8月1日(土)"。不正な形式はそのまま返す。 */
export const formatEventDateLabel = (ymd: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  // ローカルTZの影響を受けないよう UTC 正午で Date を作って曜日を得る
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日(${DOW_LABELS[d.getUTCDay()]})`;
};

/** "10:00:00" → "10:00" */
export const formatEventTimeHm = (time: string): string => time.slice(0, 5);

export const formatEventTimeRange = (start: string, end: string): string =>
  `${formatEventTimeHm(start)}〜${formatEventTimeHm(end)}`;
