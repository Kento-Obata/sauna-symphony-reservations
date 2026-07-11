// 時間帯ラベルを返すサーバ側共通ロジック。
//
// 優先順位:
//   1) daily_time_slots に明示行があれば DB の start_time/end_time を使う (唯一の真実)
//   2) 無ければデフォルトルール (土日祝=4枠 / 平日=3枠) にフォールバック
//
// 曜日/祝日判定は必ず ./date-jst.ts 経由で行うこと (Date 経由のTZバグ防止)。

import { isJstWeekendOrHoliday } from "./date-jst.ts";

export const RULE_DEFAULT_4SLOT_FROM = "2026-06-06";
// 平日も土日と同じ4枠時間へ統一する開始日（午前おやすみはフロント側の表示制御。
// ラベルは時間帯の start-end のみを返すため、ここでは時間表を統一するだけでよい）。
export const RULE_WEEKDAY_4SLOT_FROM = "2026-08-01";

// 平日 8/1 より前の従来スケジュール。
export const WEEKDAY_TIMES: Record<string, { start: string; end: string }> = {
  morning: { start: "10:00", end: "12:30" },
  afternoon: { start: "13:30", end: "16:00" },
  evening: { start: "17:00", end: "19:30" },
  night: { start: "20:00", end: "22:30" },
};

// 統一4枠（土日祝6/6〜 / 平日8/1〜）。
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

/** 平日4枠ルール（8/1以降の平日 = 土日祝以外）が適用される日か。 */
export const isWeekday4Slot = (date: string): boolean => {
  if (date < RULE_WEEKDAY_4SLOT_FROM) return false;
  return !isJstWeekendOrHoliday(date);
};

export const getDefaultSlotLabel = (timeSlot: string, date: string): string => {
  const use4Slot = shouldApplyDefault4Slot(date) || isWeekday4Slot(date);
  const table = use4Slot ? WEEKEND_4SLOT_TIMES : WEEKDAY_TIMES;
  const t = table[timeSlot] ?? WEEKDAY_TIMES[timeSlot];
  return t ? `${t.start}-${t.end}` : timeSlot;
};

/**
 * getTimeSlotLabel の直接 Postgres 版。
 * 本番では自動注入の SUPABASE_SERVICE_ROLE_KEY(legacy キー)が PostgREST に
 * 拒否されるため、supabase-js 経由の getTimeSlotLabel が機能しない。
 * 通知系関数はこちら(POSTGRES_URL 直結の sql)を使うこと。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getTimeSlotLabelViaSql = async (
  sql: any,
  timeSlot: string,
  date: string,
): Promise<string> => {
  try {
    const rows = await sql`
      select start_time, end_time
      from public.daily_time_slots
      where date = ${date}::date
        and time_slot = ${timeSlot}::public.time_slot
        and is_active = true
      limit 1
    `;
    if (rows[0]) {
      return `${String(rows[0].start_time).slice(0, 5)}-${String(rows[0].end_time).slice(0, 5)}`;
    }
    return getDefaultSlotLabel(timeSlot, date);
  } catch (e) {
    console.error("getTimeSlotLabelViaSql error:", e);
    return getDefaultSlotLabel(timeSlot, date);
  }
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
