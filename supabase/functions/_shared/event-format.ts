// イベント予約メール用の日時表記ヘルパー（純ロジック）。
// create-event-reservation / cancel-event-reservation の両方から使う。

import { getJstDayOfWeek } from "./date-jst.ts";

const DOW_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

/** "2026-08-01" → "2026年8月1日(土)"。不正な形式はそのまま返す。 */
export const formatJstDateLabel = (ymd: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日(${DOW_LABELS[getJstDayOfWeek(ymd)]})`;
};

/** "10:00:00" → "10:00"（DB の time 型は秒付きで返るため）。 */
export const formatTimeHm = (time: string): string => time.slice(0, 5);

export const formatTimeRange = (start: string, end: string): string =>
  `${formatTimeHm(start)}〜${formatTimeHm(end)}`;
