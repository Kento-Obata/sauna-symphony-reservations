import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { formatJstDateLabel, formatTimeRange } from "./event-format.ts";

Deno.test("formatJstDateLabel: 曜日付きの日本語表記", () => {
  assertEquals(formatJstDateLabel("2026-08-01"), "2026年8月1日(土)");
  assertEquals(formatJstDateLabel("2026-07-11"), "2026年7月11日(土)");
  assertEquals(formatJstDateLabel("2026-12-31"), "2026年12月31日(木)");
});

Deno.test("formatJstDateLabel: 不正形式はそのまま返す", () => {
  assertEquals(formatJstDateLabel("2026/08/01"), "2026/08/01");
});

Deno.test("formatTimeRange: 秒を落として範囲表記", () => {
  assertEquals(formatTimeRange("10:00:00", "12:30:00"), "10:00〜12:30");
  assertEquals(formatTimeRange("10:00", "12:30"), "10:00〜12:30");
});
