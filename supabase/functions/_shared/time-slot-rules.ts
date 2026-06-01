// 唯一の真実: 時間帯ラベルを返すサーバ側共通ロジック
// フロントエンド src/utils/timeSlotRules.ts と同じルールを再実装。
//
// ⚠️ 過去にあったバグ:
//   new Date("YYYY-MM-DDT00:00:00+09:00").getUTCDay() は -9h されて
//   JST 土曜→ UTC 金曜になり、土日判定が外れて平日テーブルが選ばれていた。
//   ここでは "YYYY-MM-DDT00:00:00Z" として UTC 解釈し、getUTCDay() でその暦日の曜日を取る。

import { isHoliday as isJpHoliday } from "npm:japanese-holidays@1.0.10";

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

const parseYmdAsUTC = (date: string): Date => new Date(date + "T00:00:00Z");

export const isWeekendOrHoliday = (date: string): boolean => {
  const d = parseYmdAsUTC(date);
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return true;
  // japanese-holidays は Date オブジェクトの getMonth/getDate を使うため
  // UTC 0 時の Date でも JST のその暦日として正しく扱える。
  return !!isJpHoliday(d);
};

export const shouldApplyDefault4Slot = (date: string): boolean => {
  if (date < RULE_DEFAULT_4SLOT_FROM) return false;
  return isWeekendOrHoliday(date);
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
