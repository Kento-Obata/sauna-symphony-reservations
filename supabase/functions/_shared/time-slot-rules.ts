// 時間帯ラベルを返すサーバ側共通ロジック。
//
// 優先順位:
//   1) daily_time_slots に明示行があれば DB の start_time/end_time を使う (唯一の真実)
//   2) 無ければデフォルトルール (土日祝=4枠 / 平日=3枠) にフォールバック
//
// 曜日/祝日判定は必ず ./date-jst.ts 経由で行うこと (Date 経由のTZバグ防止)。

import { isJstWeekendOrHoliday } from "./date-jst.ts";

export const RULE_DEFAULT_4SLOT_FROM = "2026-06-06";

export const WEEKDAY_TIMES: Record<string, { start: string; end: string }> = {
  morning: { start: "10:00", end: "12:30" },
  afternoon: { start: "13:30", end: "16:00" },
  evening: { start: "17:00", end: "19:30" },
  night: { start: "20:00", end: "22:30" },
};

export const WEEKEND_4SLOT_TIMES: Record<string, { start: string; end: string }> = {
  morning: { start: "10:00", end: "12:30" },
  afternoon: { start: "13:00", end: "15:30" },
  evening: { start: "16:00", end: "18:30" },
  night: { start: "19:00", end: "21:30" },
};

export const isWeekendOrHoliday = (date: string): boolean => isJstWeekendOrHoliday(date);

export const shouldApplyDefault4Slot = (date: string): boolean => {
  if (date < RULE_DEFAULT_4SLOT_FROM) return false;
  return isJstWeekendOrHoliday(date);
};

export const getDefaultSlotLabel = (timeSlot: string, date: string): string => {
  const table = shouldApplyDefault4Slot(date) ? WEEKEND_4SLOT_TIMES : WEEKDAY_TIMES;
  const t = table[timeSlot] ?? WEEKDAY_TIMES[timeSlot];
  return t ? `${t.start}-${t.end}` : timeSlot;
};

/**
 * 通知などで使う「時間帯ラベル」を返す唯一の関数。
 * 1) daily_time_slots に明示行 (is_active) があればそれを優先
 * 2) 無ければデフォルトルール (土日祝4枠/平日3枠) を適用
 */
export const getTimeSlotLabel = async (
  supabase: any,
  timeSlot: string,
  date: string
): Promise<string> => {
  try {
    const { data, error } = await supabase
      .from("daily_time_slots")
      .select("start_time, end_time")
      .eq("date", date)
      .eq("time_slot", timeSlot)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      return getDefaultSlotLabel(timeSlot, date);
    }
    return `${String(data.start_time).slice(0, 5)}-${String(data.end_time).slice(0, 5)}`;
  } catch (e) {
    console.error("getTimeSlotLabel error:", e);
    return getDefaultSlotLabel(timeSlot, date);
  }
};
