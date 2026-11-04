import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { applicableSlotsForDate, defaultApplicableSlots } from "./slot-rules.ts";

// フロントの src/utils/timeSlotRules.ts と同じ結果になること
const holidays = new Set(["2026-11-03", "2026-11-07", "2026-11-08", "2026-05-02"]); // 祝日・土日の代わり
const isHoliday = (ymd: string) => holidays.has(ymd);

Deno.test("slot-rules: 土日祝(6/6〜)は明示行が無ければ4枠", () => {
  assertEquals(defaultApplicableSlots("2026-11-07", [], isHoliday), ["morning", "afternoon", "evening", "night"]);
  assertEquals(applicableSlotsForDate("2026-11-03", [], isHoliday), ["morning", "afternoon", "evening", "night"]);
});

Deno.test("slot-rules: 土日祝でも明示行が1つでもあれば既定は3枠になり、有効な行の枠を足す", () => {
  const rows = [{ date: "2026-11-08", time_slot: "night", is_active: false }];
  assertEquals(applicableSlotsForDate("2026-11-08", rows, isHoliday), ["morning", "afternoon", "evening"]);
  const open = [{ date: "2026-11-08", time_slot: "night", is_active: true }];
  assertEquals(applicableSlotsForDate("2026-11-08", open, isHoliday), ["morning", "afternoon", "evening", "night"]);
});

Deno.test("slot-rules: 平日(8/1〜)は夕方・夜。明示的に開けた午前は開く", () => {
  assertEquals(applicableSlotsForDate("2026-11-04", [], isHoliday), ["evening", "night"]);
  const rows = [{ date: "2026-11-04", time_slot: "morning", is_active: true }];
  assertEquals(applicableSlotsForDate("2026-11-04", rows, isHoliday), ["morning", "evening", "night"]);
});

Deno.test("slot-rules: ルール開始前は従来の3枠", () => {
  assertEquals(applicableSlotsForDate("2026-05-02", [], isHoliday), ["morning", "afternoon", "evening"]);
  assertEquals(applicableSlotsForDate("2026-07-15", [], isHoliday), ["morning", "afternoon", "evening"]);
});

Deno.test("slot-rules: 既定の祝日判定(japanese-holidays)で文化の日は祝日扱い", () => {
  assertEquals(applicableSlotsForDate("2026-11-03", []), ["morning", "afternoon", "evening", "night"]);
});
