import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { getJstTodayYmd } from "./date-jst.ts";

Deno.test("getJstTodayYmd: UTC 15:00 以降は JST の翌日になる", () => {
  // UTC 2026-07-10 14:59 → JST 2026-07-10 23:59（同日）
  assertEquals(getJstTodayYmd(new Date("2026-07-10T14:59:00Z")), "2026-07-10");
  // UTC 2026-07-10 15:00 → JST 2026-07-11 00:00（翌日）
  assertEquals(getJstTodayYmd(new Date("2026-07-10T15:00:00Z")), "2026-07-11");
});

Deno.test("getJstTodayYmd: 月末・年末の繰り上がり", () => {
  assertEquals(getJstTodayYmd(new Date("2026-07-31T15:00:00Z")), "2026-08-01");
  assertEquals(getJstTodayYmd(new Date("2026-12-31T15:00:00Z")), "2027-01-01");
});
