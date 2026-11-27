import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { calcEventCancelFee } from "./event-cancel-fee.ts";

Deno.test("calcEventCancelFee: 2日前までは無料", () => {
  assertEquals(calcEventCancelFee("2026-12-10", "2026-12-08", 6000), { rate: 0, fee: 0, refundAmount: 6000 });
  assertEquals(calcEventCancelFee("2026-12-10", "2026-11-30", 6000).rate, 0);
});

Deno.test("calcEventCancelFee: 前日は30%(月またぎも前日扱い)", () => {
  assertEquals(calcEventCancelFee("2026-12-10", "2026-12-09", 6000), { rate: 30, fee: 1800, refundAmount: 4200 });
  assertEquals(calcEventCancelFee("2026-12-01", "2026-11-30", 3000), { rate: 30, fee: 900, refundAmount: 2100 });
});

Deno.test("calcEventCancelFee: 1円未満は切り捨て", () => {
  assertEquals(calcEventCancelFee("2026-12-10", "2026-12-09", 3333), { rate: 30, fee: 999, refundAmount: 2334 });
});

Deno.test("calcEventCancelFee: 当日以降は100%", () => {
  assertEquals(calcEventCancelFee("2026-12-10", "2026-12-10", 6000), { rate: 100, fee: 6000, refundAmount: 0 });
});
