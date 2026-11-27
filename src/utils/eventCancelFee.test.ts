import { describe, expect, it } from "vitest";
import { calcEventCancelFee } from "./eventCancelFee";

describe("イベントのキャンセル料", () => {
  it("2日前までは無料", () => {
    expect(calcEventCancelFee("2026-12-10", "2026-12-08", 6000)).toEqual({ rate: 0, fee: 0, refundAmount: 6000 });
  });
  it("前日は30%(月またぎ含む)", () => {
    expect(calcEventCancelFee("2026-12-10", "2026-12-09", 6000)).toEqual({ rate: 30, fee: 1800, refundAmount: 4200 });
    expect(calcEventCancelFee("2026-12-01", "2026-11-30", 3000)).toEqual({ rate: 30, fee: 900, refundAmount: 2100 });
  });
  it("1円未満は切り捨て", () => {
    expect(calcEventCancelFee("2026-12-10", "2026-12-09", 3333)).toEqual({ rate: 30, fee: 999, refundAmount: 2334 });
  });
  it("当日は100%", () => {
    expect(calcEventCancelFee("2026-12-10", "2026-12-10", 6000)).toEqual({ rate: 100, fee: 6000, refundAmount: 0 });
  });
});
