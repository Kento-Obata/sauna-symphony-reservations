import { format, parseISO } from "date-fns";
import { isWeekendOrHoliday } from "./holidayUtils";

/**
 * 「この日付以降、土日祝は明示設定が無くても 4 枠（night を含む）」というデフォルトルールの開始日。
 * この日より前、または平日は従来どおり 3 枠。
 */
export const RULE_DEFAULT_4SLOT_FROM = "2026-06-06";

interface DailyTimeSlotRowLite {
  date: string;
  time_slot: string;
  is_active?: boolean;
}

/**
 * その日付に「明示的な daily_time_slots レコード」があるかどうか。
 * is_active を問わず、何か 1 行でもあれば「明示設定済み」と判定する
 * （3 枠ロックも含めてユーザーの意図を尊重するため）。
 */
export const hasExplicitDailySlots = (
  date: Date | string,
  dailyTimeSlots?: DailyTimeSlotRowLite[]
): boolean => {
  if (!dailyTimeSlots?.length) return false;
  const dateStr = typeof date === "string" ? date : format(date, "yyyy-MM-dd");
  return dailyTimeSlots.some((dts) => dts.date === dateStr);
};

/**
 * デフォルトルールにより night 枠が自動的に追加されるべき日かどうか。
 *  - RULE_DEFAULT_4SLOT_FROM 以降
 *  - 土日または祝日
 *  - その日に明示的な daily_time_slots レコードが 1 つも無い
 */
export const shouldApplyDefault4Slot = (
  date: Date | string,
  dailyTimeSlots?: DailyTimeSlotRowLite[]
): boolean => {
  const d = typeof date === "string" ? parseISO(date) : date;
  const dateStr = format(d, "yyyy-MM-dd");
  if (dateStr < RULE_DEFAULT_4SLOT_FROM) return false;
  if (!isWeekendOrHoliday(d)) return false;
  if (hasExplicitDailySlots(dateStr, dailyTimeSlots)) return false;
  return true;
};

/**
 * ルール適用日（土日祝4枠）の枠時間定義。
 * 平日3枠とは異なり、休憩30分でずれた時間帯を使う。
 */
export const WEEKEND_4SLOT_TIMES = {
  morning: { start: "10:00", end: "12:30" },
  afternoon: { start: "13:00", end: "15:30" },
  evening: { start: "16:00", end: "18:30" },
  night: { start: "19:00", end: "21:30" },
} as const;

/**
 * その日付・スロットのデフォルト時間を返す。
 * - ルール適用日（4枠）→ WEEKEND_4SLOT_TIMES
 * - それ以外 → 平日3枠 + night フォールバック
 */
export const getDefaultSlotTimesForDate = (
  date: Date | string,
  slot: string,
  dailyTimeSlots?: DailyTimeSlotRowLite[]
): { start: string; end: string } => {
  const WEEKDAY: Record<string, { start: string; end: string }> = {
    morning: { start: "10:00", end: "12:30" },
    afternoon: { start: "13:30", end: "16:00" },
    evening: { start: "17:00", end: "19:30" },
    night: { start: "20:00", end: "22:30" },
  };
  if (shouldApplyDefault4Slot(date, dailyTimeSlots)) {
    return (WEEKEND_4SLOT_TIMES as Record<string, { start: string; end: string }>)[slot] ?? WEEKDAY[slot] ?? { start: "00:00", end: "00:00" };
  }
  return WEEKDAY[slot] ?? { start: "00:00", end: "00:00" };
};

/**
 * その日付の最大予約枠数（3 or 4）。
 * 明示的な night の active 行 or 土日祝デフォルト4枠ルールが適用されれば 4。
 */
export const getMaxSlotsForDate = (
  date: Date | string,
  dailyTimeSlots?: DailyTimeSlotRowLite[]
): number => {
  const dateStr = typeof date === "string" ? date : format(date, "yyyy-MM-dd");
  const hasExplicitNight = !!dailyTimeSlots?.some(
    (dts) => dts.date === dateStr && dts.time_slot === "night" && (dts as any).is_active
  );
  if (hasExplicitNight) return 4;
  if (shouldApplyDefault4Slot(date, dailyTimeSlots)) return 4;
  return 3;
};
