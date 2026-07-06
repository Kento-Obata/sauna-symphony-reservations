import { describe, it, expect } from "vitest";
import {
  getApplicableSlotsForDate,
  getDefaultApplicableSlots,
  getDefaultSlotTimesForDate,
  getMaxSlotsForDate,
  isNightSlotDefault,
  isWeekday4SlotDate,
} from "./timeSlotRules";

// 代表日（JST暦日として扱う。ローカルTZに依らず曜日が正しくなるよう date-only 文字列を使用）
const WEEKDAY_POST = "2026-08-03"; // 月・8/1以降の平日
const WEEKDAY_PRE = "2026-07-06"; // 月・8/1より前の平日
const SATURDAY = "2026-08-08"; // 土
const HOLIDAY = "2026-08-11"; // 火・山の日（祝日）
const CUTOVER_SAT = "2026-08-01"; // 土（境界。土日ルールで4枠）

const times = (date: string, slots: string[]) =>
  slots.map((s) => {
    const t = getDefaultSlotTimesForDate(date, s);
    return `${s} ${t.start}-${t.end}`;
  });

describe("平日4枠ルール（RULE_WEEKDAY_4SLOT_FROM = 2026-08-01）", () => {
  it("8/1以降の平日: 午前おやすみ + 午後/夕方/夜の3枠稼働", () => {
    expect(getApplicableSlotsForDate(WEEKDAY_POST)).toEqual([
      "afternoon",
      "evening",
      "night",
    ]);
    expect(getMaxSlotsForDate(WEEKDAY_POST)).toBe(3);
    expect(isWeekday4SlotDate(WEEKDAY_POST)).toBe(true);
  });

  it("8/1以降の平日: 時間帯は土日と同一の統一4枠時間", () => {
    expect(times(WEEKDAY_POST, ["afternoon", "evening", "night"])).toEqual([
      "afternoon 13:00-15:30",
      "evening 16:00-18:30",
      "night 19:00-21:30",
    ]);
    // 午前を開放した場合の既定時刻
    expect(getDefaultSlotTimesForDate(WEEKDAY_POST, "morning")).toEqual({
      start: "10:00",
      end: "12:30",
    });
  });

  it("8/1以降の平日: 管理画面で午前を明示開放（active morning 行）すると4枠になる", () => {
    const openMorning = [
      { date: WEEKDAY_POST, time_slot: "morning", is_active: true },
    ];
    expect(getApplicableSlotsForDate(WEEKDAY_POST, openMorning)).toEqual([
      "morning",
      "afternoon",
      "evening",
      "night",
    ]);
    expect(getMaxSlotsForDate(WEEKDAY_POST, openMorning)).toBe(4);
  });

  it("8/1より前の平日: 従来3枠・従来時間のまま（既存予約の表示時刻を保護）", () => {
    expect(getApplicableSlotsForDate(WEEKDAY_PRE)).toEqual([
      "morning",
      "afternoon",
      "evening",
    ]);
    expect(isWeekday4SlotDate(WEEKDAY_PRE)).toBe(false);
    expect(times(WEEKDAY_PRE, ["morning", "afternoon", "evening"])).toEqual([
      "morning 10:00-12:30",
      "afternoon 13:30-16:00",
      "evening 17:00-19:30",
    ]);
  });
});

describe("土日祝は従来どおり4枠（午前あり）", () => {
  it("土曜: 4枠・統一時間", () => {
    expect(getApplicableSlotsForDate(SATURDAY)).toEqual([
      "morning",
      "afternoon",
      "evening",
      "night",
    ]);
    expect(times(SATURDAY, ["morning", "afternoon", "evening", "night"])).toEqual([
      "morning 10:00-12:30",
      "afternoon 13:00-15:30",
      "evening 16:00-18:30",
      "night 19:00-21:30",
    ]);
  });

  it("祝日(山の日)は土日扱いで4枠（平日午前おやすみの対象外）", () => {
    expect(getApplicableSlotsForDate(HOLIDAY)).toEqual([
      "morning",
      "afternoon",
      "evening",
      "night",
    ]);
    expect(isWeekday4SlotDate(HOLIDAY)).toBe(false);
  });

  it("境界 2026-08-01 は土曜 → 土日ルールで4枠（平日ルール適用外）", () => {
    expect(isWeekday4SlotDate(CUTOVER_SAT)).toBe(false);
    expect(getApplicableSlotsForDate(CUTOVER_SAT)).toEqual([
      "morning",
      "afternoon",
      "evening",
      "night",
    ]);
  });
});

describe("既存挙動の維持（回帰防止）", () => {
  it("土日6/6以降で明示3枠ロック（明示行あり）は3枠のまま自動4枠化しない", () => {
    const lock3 = [
      { date: SATURDAY, time_slot: "morning", is_active: true },
      { date: SATURDAY, time_slot: "afternoon", is_active: true },
      { date: SATURDAY, time_slot: "evening", is_active: true },
    ];
    expect(getApplicableSlotsForDate(SATURDAY, lock3)).toEqual([
      "morning",
      "afternoon",
      "evening",
    ]);
  });

  it("isNightSlotDefault: 土日・平日8/1以降で true、平日8/1前で false", () => {
    expect(isNightSlotDefault(SATURDAY)).toBe(true);
    expect(isNightSlotDefault(WEEKDAY_POST)).toBe(true);
    expect(isNightSlotDefault(WEEKDAY_PRE)).toBe(false);
  });

  it("getDefaultApplicableSlots は占有・明示行を除いた既定集合を返す", () => {
    expect(getDefaultApplicableSlots(WEEKDAY_POST)).toEqual([
      "afternoon",
      "evening",
      "night",
    ]);
  });
});

// --- フロント↔バック 契約（ゴールデン値）---
// このテーブルは supabase/functions/_shared/time-slot-rules_test.ts の
// getDefaultSlotLabel 期待値と一致させること。片方だけ変えると通知と表示がズレる。
describe("契約: フロントの時刻ラベルはバックエンドと一致する（ゴールデン値）", () => {
  const golden: Array<[string, string, string]> = [
    ["2026-08-03", "afternoon", "13:00-15:30"], // 平日8/1以降
    ["2026-08-03", "evening", "16:00-18:30"],
    ["2026-08-03", "night", "19:00-21:30"],
    ["2026-07-06", "afternoon", "13:30-16:00"], // 平日8/1前（従来）
    ["2026-07-06", "night", "20:00-22:30"],
    ["2026-08-08", "afternoon", "13:00-15:30"], // 土
    ["2026-08-11", "night", "19:00-21:30"], // 祝日
  ];
  it.each(golden)("%s / %s = %s", (date, slot, label) => {
    const t = getDefaultSlotTimesForDate(date, slot);
    expect(`${t.start}-${t.end}`).toBe(label);
  });
});
