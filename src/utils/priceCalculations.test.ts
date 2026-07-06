import { describe, it, expect } from "vitest";
import {
  calculateOptionTotalPrice,
  formatPrice,
  getSurcharge,
} from "./priceCalculations";
import type { Option } from "@/types/option";

const opt = (over: Partial<Option>): Option =>
  ({
    id: "o1",
    name: "opt",
    pricing_type: "per_person",
    price_per_person: 1000,
    flat_price: null,
    is_active: true,
    ...over,
  } as unknown as Option);

describe("calculateOptionTotalPrice", () => {
  it("flat: 数量・人数に依らず flat_price", () => {
    const o = opt({ pricing_type: "flat", flat_price: 3000 });
    expect(calculateOptionTotalPrice(o, 5, 2)).toBe(3000);
  });

  it("per_guest: price_per_person × 予約人数", () => {
    const o = opt({ pricing_type: "per_guest", price_per_person: 800 });
    expect(calculateOptionTotalPrice(o, 1, 4)).toBe(3200);
  });

  it("per_person: price_per_person × min(数量, 人数)（人数上限でキャップ）", () => {
    const o = opt({ pricing_type: "per_person", price_per_person: 1000 });
    expect(calculateOptionTotalPrice(o, 2, 3)).toBe(2000); // 数量2 ≤ 人数3
    expect(calculateOptionTotalPrice(o, 5, 3)).toBe(3000); // 数量5 > 人数3 → 3でキャップ
  });
});

describe("formatPrice / getSurcharge", () => {
  it("formatPrice は円記号＋桁区切り", () => {
    expect(formatPrice(15000)).toBe("¥15,000");
    expect(formatPrice(0)).toBe("¥0");
  });

  it("getSurcharge は現状常に0（水温サーチャージ未導入）", () => {
    expect(getSurcharge("5")).toBe(0);
    expect(getSurcharge("15")).toBe(0);
  });
});
