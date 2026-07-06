import { format, parseISO } from "date-fns";
import { isWeekendOrHoliday } from "./holidayUtils";
import type { TimeSlot } from "@/types/reservation";

/**
 * 「この日付以降、土日祝は明示設定が無くても 4 枠（night を含む）」というデフォルトルールの開始日。
 * この日より前、または平日は従来どおり 3 枠。
 */
export const RULE_DEFAULT_4SLOT_FROM = "2026-06-06";

/**
 * 「この日付以降、平日も土日と同じ 4 枠時間へ統一。ただし午前(10:00-12:30)は既定でおやすみ」
 * という平日ルールの開始日。この日より前の平日は従来どおり（3枠・従来時間）。
 * 既存の平日予約の表示時刻を遡って変えないよう、開始日で区切る。
 */
export const RULE_WEEKDAY_4SLOT_FROM = "2026-08-01";

/** 枠の並び順（表示・集計の基準）。 */
export const SLOT_ORDER: TimeSlot[] = ["morning", "afternoon", "evening", "night"];

/** 枠の日本語ラベル（UI 共通）。 */
export const SLOT_LABELS: Record<TimeSlot, string> = {
  morning: "午前",
  afternoon: "午後",
  evening: "夕方",
  night: "夜",
};

/**
 * 統一 4 枠（30 分休憩ずつ）。土日祝(6/6〜) と 平日(8/1〜) の両方で使う
 * going-forward の正準スケジュール。
 */
export const WEEKEND_4SLOT_TIMES = {
  morning: { start: "10:00", end: "12:30" },
  afternoon: { start: "13:00", end: "15:30" },
  evening: { start: "16:00", end: "18:30" },
  night: { start: "19:00", end: "21:30" },
} as const;

/** 平日 8/1 より前の従来スケジュール（3 枠 + night フォールバック）。 */
export const WEEKDAY_LEGACY_TIMES = {
  morning: { start: "10:00", end: "12:30" },
  afternoon: { start: "13:30", end: "16:00" },
  evening: { start: "17:00", end: "19:30" },
  night: { start: "20:00", end: "22:30" },
} as const;

interface DailyTimeSlotRowLite {
  date: string;
  time_slot: string;
  is_active?: boolean;
}

const toDateStr = (date: Date | string): string =>
  typeof date === "string" ? date : format(date, "yyyy-MM-dd");

const toDate = (date: Date | string): Date =>
  typeof date === "string" ? parseISO(date) : date;

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
  const dateStr = toDateStr(date);
  return dailyTimeSlots.some((dts) => dts.date === dateStr);
};

/**
 * デフォルトルール（土日祝4枠）により night 枠が自動的に追加されるべき日かどうか。
 *  - RULE_DEFAULT_4SLOT_FROM 以降
 *  - 土日または祝日
 *  - その日に明示的な daily_time_slots レコードが 1 つも無い
 */
export const shouldApplyDefault4Slot = (
  date: Date | string,
  dailyTimeSlots?: DailyTimeSlotRowLite[]
): boolean => {
  const dateStr = toDateStr(date);
  if (dateStr < RULE_DEFAULT_4SLOT_FROM) return false;
  if (!isWeekendOrHoliday(toDate(date))) return false;
  if (hasExplicitDailySlots(dateStr, dailyTimeSlots)) return false;
  return true;
};

/**
 * 平日 4 枠ルール（8/1 以降の平日 = 土日祝以外）が適用される日かどうか。
 * 土日祝は shouldApplyDefault4Slot 側で扱うためここでは対象外。
 * 平日ルールは明示行の有無に依らず適用する（午前おやすみを明示行で解除させないため）。
 */
export const isWeekday4SlotDate = (date: Date | string): boolean => {
  const dateStr = toDateStr(date);
  if (dateStr < RULE_WEEKDAY_4SLOT_FROM) return false;
  return !isWeekendOrHoliday(toDate(date));
};

/**
 * その日付で「既定で開いている枠」の一覧。
 * （予約占有フィルタや、管理画面で個別に開いた明示行の追加分は含めない基準集合）
 *  - 土日祝(6/6〜, 明示行なし): 午前・午後・夕方・夜 の 4 枠
 *  - 平日(8/1〜): 午後・夕方・夜（午前は既定おやすみ）
 *  - それ以外(従来): 午前・午後・夕方
 */
export const getDefaultApplicableSlots = (
  date: Date | string,
  dailyTimeSlots?: DailyTimeSlotRowLite[]
): TimeSlot[] => {
  if (shouldApplyDefault4Slot(date, dailyTimeSlots)) {
    return ["morning", "afternoon", "evening", "night"];
  }
  if (isWeekday4SlotDate(date)) {
    return ["afternoon", "evening", "night"];
  }
  return ["morning", "afternoon", "evening"];
};

/** night 枠がその日の既定で開いているか（管理カレンダー等の行表示判定用）。 */
export const isNightSlotDefault = (
  date: Date | string,
  dailyTimeSlots?: DailyTimeSlotRowLite[]
): boolean => getDefaultApplicableSlots(date, dailyTimeSlots).includes("night");

/**
 * その日付に表示すべき枠一覧（予約占有フィルタ前）。
 * 既定集合に加え、明示的な active 行がある枠を開く
 * （例: 平日 8/1〜の「午前おやすみ」を、特定日だけ明示行で開放する）。
 */
export const getApplicableSlotsForDate = (
  date: Date | string,
  dailyTimeSlots?: DailyTimeSlotRowLite[]
): TimeSlot[] => {
  const dateStr = toDateStr(date);
  const defaults = getDefaultApplicableSlots(date, dailyTimeSlots);
  return SLOT_ORDER.filter((slot) => {
    if (defaults.includes(slot)) return true;
    return !!dailyTimeSlots?.some(
      (dts) => dts.date === dateStr && dts.time_slot === slot && dts.is_active
    );
  });
};

/**
 * その日付・スロットのデフォルト時間を返す。
 * - 土日祝4枠 or 平日4枠(8/1〜) → WEEKEND_4SLOT_TIMES（統一）
 * - それ以外 → 従来の平日時間（WEEKDAY_LEGACY_TIMES）
 */
export const getDefaultSlotTimesForDate = (
  date: Date | string,
  slot: string,
  dailyTimeSlots?: DailyTimeSlotRowLite[]
): { start: string; end: string } => {
  const use4Slot =
    shouldApplyDefault4Slot(date, dailyTimeSlots) || isWeekday4SlotDate(date);
  const table = (use4Slot ? WEEKEND_4SLOT_TIMES : WEEKDAY_LEGACY_TIMES) as Record<
    string,
    { start: string; end: string }
  >;
  return (
    table[slot] ??
    (WEEKDAY_LEGACY_TIMES as Record<string, { start: string; end: string }>)[slot] ??
    { start: "00:00", end: "00:00" }
  );
};

/**
 * その日付の最大予約枠数。表示すべき枠一覧の要素数と一致する。
 */
export const getMaxSlotsForDate = (
  date: Date | string,
  dailyTimeSlots?: DailyTimeSlotRowLite[]
): number => getApplicableSlotsForDate(date, dailyTimeSlots).length;
