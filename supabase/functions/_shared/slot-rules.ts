// その日に「どの枠が開いているか」の判定。フロントの src/utils/timeSlotRules.ts
// (getDefaultApplicableSlots / getApplicableSlotsForDate)と同じルールで、変えるときは両方を揃えること。
// 枠の時刻そのものは DB(reservations.start_time / end_time・default_slot_times())が正。
//
//   - 土日祝(2026-06-06〜)で daily_time_slots の行が1つも無い日: 午前・午後・夕方・夜
//   - 平日(2026-08-01〜): 夕方・夜(午前・午後は既定でおやすみ)
//   - それ以外: 午前・午後・夕方
//   - 上に加えて、daily_time_slots に有効(is_active)な行がある枠は開く

import { isJstWeekendOrHoliday } from "./date-jst.ts";

export type TimeSlot = "morning" | "afternoon" | "evening" | "night";

export const SLOT_ORDER: TimeSlot[] = ["morning", "afternoon", "evening", "night"];

export const SLOT_LABELS: Record<TimeSlot, string> = {
  morning: "午前",
  afternoon: "午後",
  evening: "夕方",
  night: "夜",
};

export const RULE_DEFAULT_4SLOT_FROM = "2026-06-06";
export const RULE_WEEKDAY_4SLOT_FROM = "2026-08-01";

export interface DailySlotRow {
  date: string;
  time_slot: string;
  is_active: boolean;
}

export const defaultApplicableSlots = (
  date: string,
  dailyRows: DailySlotRow[],
  isWeekendOrHoliday: (ymd: string) => boolean = isJstWeekendOrHoliday,
): TimeSlot[] => {
  const holidayLike = isWeekendOrHoliday(date);
  const hasExplicitRows = dailyRows.some((r) => r.date === date);
  if (date >= RULE_DEFAULT_4SLOT_FROM && holidayLike && !hasExplicitRows) return [...SLOT_ORDER];
  if (date >= RULE_WEEKDAY_4SLOT_FROM && !holidayLike) return ["evening", "night"];
  return ["morning", "afternoon", "evening"];
};

export const applicableSlotsForDate = (
  date: string,
  dailyRows: DailySlotRow[],
  isWeekendOrHoliday: (ymd: string) => boolean = isJstWeekendOrHoliday,
): TimeSlot[] => {
  const defaults = defaultApplicableSlots(date, dailyRows, isWeekendOrHoliday);
  return SLOT_ORDER.filter((slot) =>
    defaults.includes(slot) || dailyRows.some((r) => r.date === date && r.time_slot === slot && r.is_active)
  );
};
