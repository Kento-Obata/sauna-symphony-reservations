import { describe, it, expect } from "vitest";
import { addJstDays, getJstTodayYmd } from "./jstDate";

describe("addJstDays", () => {
  it("月末・年末をまたいで日数を足す", () => {
    expect(addJstDays("2026-10-30", 2)).toBe("2026-11-01");
    expect(addJstDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addJstDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("オンラインキャンセルの期限(2日前まで)", () => {
  // JST 2026-10-27 23:30 (= UTC 14:30)
  const today = getJstTodayYmd(new Date("2026-10-27T14:30:00Z"));
  const canCancel = (date: string) => date >= addJstDays(today, 2);
  it("2日前はキャンセル可、前日・当日は不可", () => {
    expect(today).toBe("2026-10-27");
    expect(canCancel("2026-10-29")).toBe(true);
    expect(canCancel("2026-10-28")).toBe(false);
    expect(canCancel("2026-10-27")).toBe(false);
  });
});
