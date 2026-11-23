import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { buildEventBringItemsNotice } from "./event-notice.ts";

Deno.test("buildEventBringItemsNotice: 金額一覧なしでも持参の案内は出る", () => {
  const text = buildEventBringItemsNotice([]);
  assertStringIncludes(text, "無料貸出はございません");
  assertStringIncludes(text, "水着とタオルはご持参ください");
  assertEquals(text.includes("当日ご利用いただけるオプション"), false);
});

Deno.test("buildEventBringItemsNotice: オプション料金を並べる", () => {
  const text = buildEventBringItemsNotice([
    { name: "水着", price: 500 },
    { name: "おかゆ", price: 1200 },
  ]);
  assertStringIncludes(text, "・水着 500円");
  assertStringIncludes(text, "・おかゆ 1,200円");
});
