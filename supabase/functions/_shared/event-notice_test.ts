import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { buildEventBringItemsNotice, buildEventCancelPolicyNotice } from "./event-notice.ts";

Deno.test("buildEventBringItemsNotice: 金額一覧なしでも持参の案内は出る", () => {
  const text = buildEventBringItemsNotice([]);
  assertStringIncludes(text, "水着・サウナハット・ポンチョは有料レンタル");
  assertStringIncludes(text, "足巻きタオルは無料");
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

Deno.test("buildEventCancelPolicyNotice: 2日前まで無料・前日30%・当日と無断は100%", () => {
  const text = buildEventCancelPolicyNotice();
  assertStringIncludes(text, "【キャンセルポリシー】");
  assertStringIncludes(text, "2日前まで：無料（全額返金）");
  assertStringIncludes(text, "前日：料金の30%");
  assertStringIncludes(text, "当日：料金の100%");
  assertStringIncludes(text, "無断キャンセル：料金の100%");
});
