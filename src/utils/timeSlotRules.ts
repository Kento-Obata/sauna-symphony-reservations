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
