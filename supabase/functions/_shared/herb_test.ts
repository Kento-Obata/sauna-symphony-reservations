import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  formatHerbEmailBlock,
  formatHerbStaffLine,
  herbErrorMessage,
  normalizeHerbTiers,
} from "./herb.ts";

const BLEND_A = "11111111-1111-4111-8111-111111111111";
const BLEND_B = "22222222-2222-4222-8222-222222222222";
const HERB = "33333333-3333-4333-8333-333333333333";

const recommended = {
  tiers: [
    {
      tier: 1, code: "01", title: "Uの基本", is_original: false, needs_prep: false,
      herbs: [
        { id: "h1", name: "レモングラス", note: "top" },
        { id: "h2", name: "ローズマリー", note: "middle" },
        { id: "h3", name: "セージ", note: "base" },
      ],
    },
    {
      tier: 2, code: "07", title: "ORIGINAL", is_original: true, needs_prep: true,
      herbs: [
        { id: "h4", name: "ラベンダー", note: "top" },
        { id: "h5", name: "香木", note: "base" },
      ],
    },
  ],
};

Deno.test("normalizeHerbTiers: 未指定は空配列", () => {
  assertEquals(normalizeHerbTiers(undefined), []);
  assertEquals(normalizeHerbTiers(null), []);
});

Deno.test("normalizeHerbTiers: 正しい形式を通す", () => {
  assertEquals(
    normalizeHerbTiers([
      { tier: 1, blend_id: BLEND_A },
      { tier: 2, blend_id: BLEND_B, herb_ids: [HERB] },
    ]),
    [
      { tier: 1, blend_id: BLEND_A, herb_ids: [] },
      { tier: 2, blend_id: BLEND_B, herb_ids: [HERB] },
    ],
  );
});

Deno.test("normalizeHerbTiers: 不正な形式は null", () => {
  assertEquals(normalizeHerbTiers("x"), null);
  assertEquals(normalizeHerbTiers([{ tier: 3, blend_id: BLEND_A }]), null);
  assertEquals(normalizeHerbTiers([{ tier: 1, blend_id: "not-a-uuid" }]), null);
  assertEquals(normalizeHerbTiers([{ tier: 1, blend_id: BLEND_A, herb_ids: [HERB, HERB, HERB, HERB] }]), null);
  assertEquals(normalizeHerbTiers([{ tier: 1, blend_id: BLEND_A }, { tier: 2, blend_id: BLEND_B }, { tier: 1, blend_id: BLEND_A }]), null);
});

Deno.test("herbErrorMessage: DB 関数の例外を日本語にする", () => {
  assertEquals(
    herbErrorMessage(new Error("herb_original_invalid")),
    "ORIGINALは、ハーブを1〜3種お選びください",
  );
  assertEquals(herbErrorMessage(new Error("connection refused")), null);
});

Deno.test("formatHerbEmailBlock: 選び方と段ごとの構成", () => {
  assertEquals(
    formatHerbEmailBlock("recommended", recommended),
    [
      "【ハーブ蒸し】",
      "選び方: おすすめ",
      "1段目: 01 Uの基本（T レモングラス / M ローズマリー / B セージ）",
      "2段目: 07 ORIGINAL（T ラベンダー / B 香木）",
    ].join("\n"),
  );
});

Deno.test("formatHerbEmailBlock: 当日・機能導入前", () => {
  assertEquals(formatHerbEmailBlock("consult", null), "【ハーブ蒸し】\n当日スタッフと一緒に選びます");
  assertEquals(formatHerbEmailBlock(null, null), null);
});

Deno.test("formatHerbStaffLine: 仕込みと受付相談を目立たせる", () => {
  assertEquals(
    formatHerbStaffLine("select", JSON.stringify(recommended)),
    "🌿 事前 01 Uの基本 ＋ 07 ORIGINAL（ラベンダー・香木） ⚠仕込み",
  );
  assertEquals(formatHerbStaffLine("consult", null), "🌿 当日相談（受付で一緒に選ぶ）");
  assertEquals(formatHerbStaffLine("consult", recommended)?.startsWith("🌿 当日決定 "), true);
  assertEquals(formatHerbStaffLine(null, null), null);
});
