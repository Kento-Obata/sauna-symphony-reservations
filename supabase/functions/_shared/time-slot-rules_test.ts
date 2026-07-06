import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { getJstDayOfWeek, isJstWeekend, isJstWeekendOrHoliday } from "./date-jst.ts";
import { getDefaultSlotLabel, isWeekday4Slot, shouldApplyDefault4Slot } from "./time-slot-rules.ts";

Deno.test("getJstDayOfWeek: 2026-06-13 は土曜 (6)", () => {
  assertEquals(getJstDayOfWeek("2026-06-13"), 6);
});

Deno.test("getJstDayOfWeek: 2026-06-14 は日曜 (0)", () => {
  assertEquals(getJstDayOfWeek("2026-06-14"), 0);
});

Deno.test("getJstDayOfWeek: 2026-06-05 は金曜 (5)", () => {
  assertEquals(getJstDayOfWeek("2026-06-05"), 5);
});

Deno.test("isJstWeekend: 土日のみ true", () => {
  assertEquals(isJstWeekend("2026-06-13"), true);
  assertEquals(isJstWeekend("2026-06-14"), true);
  assertEquals(isJstWeekend("2026-06-15"), false);
});

Deno.test("isJstWeekendOrHoliday: 2026-07-20 海の日(月) は祝日扱い", () => {
  assertEquals(isJstWeekendOrHoliday("2026-07-20"), true);
});

Deno.test("shouldApplyDefault4Slot: 閾値前は false", () => {
  assertEquals(shouldApplyDefault4Slot("2026-05-30"), false); // 土だが閾値前
});

Deno.test("shouldApplyDefault4Slot: 閾値以降の土曜は true", () => {
  assertEquals(shouldApplyDefault4Slot("2026-06-06"), true);
  assertEquals(shouldApplyDefault4Slot("2026-06-13"), true);
});

Deno.test("getDefaultSlotLabel: 2026-06-13 afternoon = 13:00-15:30", () => {
  assertEquals(getDefaultSlotLabel("afternoon", "2026-06-13"), "13:00-15:30");
});

Deno.test("getDefaultSlotLabel: 2026-06-13 night = 19:00-21:30", () => {
  assertEquals(getDefaultSlotLabel("night", "2026-06-13"), "19:00-21:30");
});

Deno.test("getDefaultSlotLabel: 2026-06-14 evening = 16:00-18:30", () => {
  assertEquals(getDefaultSlotLabel("evening", "2026-06-14"), "16:00-18:30");
});

Deno.test("getDefaultSlotLabel: 平日 2026-06-12(金) night = 20:00-22:30", () => {
  assertEquals(getDefaultSlotLabel("night", "2026-06-12"), "20:00-22:30");
});

Deno.test("getDefaultSlotLabel: 祝日 2026-07-20(月・海の日) night = 19:00-21:30", () => {
  assertEquals(getDefaultSlotLabel("night", "2026-07-20"), "19:00-21:30");
});

// --- 平日4枠ルール (RULE_WEEKDAY_4SLOT_FROM = 2026-08-01) ---

Deno.test("isWeekday4Slot: 8/1以降の平日 2026-08-03(月) は true", () => {
  assertEquals(isWeekday4Slot("2026-08-03"), true);
});

Deno.test("isWeekday4Slot: 閾値前の平日 2026-07-06(月) は false", () => {
  assertEquals(isWeekday4Slot("2026-07-06"), false);
});

Deno.test("isWeekday4Slot: 土日は false（土日は土日ルールで処理）", () => {
  assertEquals(isWeekday4Slot("2026-08-01"), false); // 土
  assertEquals(isWeekday4Slot("2026-08-02"), false); // 日
});

Deno.test("isWeekday4Slot: 祝日は false 2026-08-11(火・山の日)", () => {
  assertEquals(isWeekday4Slot("2026-08-11"), false);
});

Deno.test("getDefaultSlotLabel: 平日 2026-08-03(月) は土日と同一の統一4枠時間", () => {
  assertEquals(getDefaultSlotLabel("morning", "2026-08-03"), "10:00-12:30");
  assertEquals(getDefaultSlotLabel("afternoon", "2026-08-03"), "13:00-15:30");
  assertEquals(getDefaultSlotLabel("evening", "2026-08-03"), "16:00-18:30");
  assertEquals(getDefaultSlotLabel("night", "2026-08-03"), "19:00-21:30");
});

Deno.test("getDefaultSlotLabel: 閾値前の平日 2026-07-06(月) は従来時間のまま（既存予約保護）", () => {
  assertEquals(getDefaultSlotLabel("afternoon", "2026-07-06"), "13:30-16:00");
  assertEquals(getDefaultSlotLabel("evening", "2026-07-06"), "17:00-19:30");
  assertEquals(getDefaultSlotLabel("night", "2026-07-06"), "20:00-22:30");
});
