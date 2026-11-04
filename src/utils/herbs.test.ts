import { describe, expect, it } from "vitest";
import {
  canCustomerChangeHerbs,
  createHerbInput,
  describeHerbInput,
  describeSavedHerbChoice,
  formatComposition,
  formatTierShort,
  herbInputFromReservation,
  herbTiersPayload,
  isHerbInputComplete,
  selectionNeedsPrep,
  type HerbCatalog,
} from "./herbs";

const herbs = {
  lemongrass: { id: "h-lemongrass", name: "レモングラス", note: "top" as const },
  lavender: { id: "h-lavender", name: "ラベンダー", note: "top" as const },
  rosemary: { id: "h-rosemary", name: "ローズマリー", note: "middle" as const },
  sage: { id: "h-sage", name: "セージ", note: "base" as const },
  agarwood: { id: "h-agarwood", name: "香木", note: "base" as const },
};

const catalog: HerbCatalog = {
  herbs: Object.values(herbs),
  blends: [
    {
      id: "b01", code: "01", title: "Uの基本", description: null, caution: null,
      is_original: false, needs_prep: false, available: true,
      herbs: [herbs.lemongrass, herbs.rosemary, herbs.sage],
    },
    {
      id: "b02", code: "02", title: "Uの基本 2", description: null, caution: null,
      is_original: false, needs_prep: false, available: true, herbs: [],
    },
    {
      id: "b03", code: "03", title: "在庫切れ", description: null, caution: null,
      is_original: false, needs_prep: false, available: false, herbs: [],
    },
    {
      id: "b07", code: "07", title: "ORIGINAL", description: null, caution: null,
      is_original: true, needs_prep: true, available: true, herbs: [],
    },
  ],
  recommended: { tier1_blend_id: "b01", tier2_blend_id: "b02", available: true },
};

describe("isHerbInputComplete", () => {
  it("おすすめ・当日は段の入力なしで完了", () => {
    expect(isHerbInputComplete(createHerbInput("recommended"), catalog)).toBe(true);
    expect(isHerbInputComplete(createHerbInput("consult"), catalog)).toBe(true);
  });

  it("事前に選ぶは 1段目・2段目の両方が必要", () => {
    const input = createHerbInput("select");
    input.tiers[1].blend_id = "b01";
    expect(isHerbInputComplete(input, catalog)).toBe(false);
    input.tiers[2].blend_id = "b01"; // 同じブレンドを両段で選ぶのは可
    expect(isHerbInputComplete(input, catalog)).toBe(true);
  });

  it("ORIGINAL は 1〜3 種", () => {
    const input = createHerbInput("select");
    input.tiers[1].blend_id = "b01";
    input.tiers[2].blend_id = "b07";
    expect(isHerbInputComplete(input, catalog)).toBe(false);
    input.tiers[2].herb_ids = [herbs.lavender.id];
    expect(isHerbInputComplete(input, catalog)).toBe(true);
    input.tiers[2].herb_ids = [herbs.lavender.id, herbs.rosemary.id, herbs.sage.id, herbs.agarwood.id];
    expect(isHerbInputComplete(input, catalog)).toBe(false);
  });

  it("在庫切れのブレンドは選べない", () => {
    const input = createHerbInput("select");
    input.tiers[1].blend_id = "b03";
    input.tiers[2].blend_id = "b01";
    expect(isHerbInputComplete(input, catalog)).toBe(false);
  });
});

describe("herbTiersPayload", () => {
  it("事前に選ぶのときだけ段を送る", () => {
    const input = createHerbInput("select");
    input.tiers[1].blend_id = "b01";
    input.tiers[2] = { blend_id: "b07", herb_ids: [herbs.lavender.id] };
    expect(herbTiersPayload(input)).toEqual([
      { tier: 1, blend_id: "b01", herb_ids: [] },
      { tier: 2, blend_id: "b07", herb_ids: [herbs.lavender.id] },
    ]);
    expect(herbTiersPayload({ ...input, choice: "recommended" })).toEqual([]);
    expect(herbTiersPayload({ ...input, choice: "consult" })).toEqual([]);
  });

  it("受付では当日の確定内容も送れる", () => {
    const input = createHerbInput("consult");
    input.tiers[1].blend_id = "b01";
    input.tiers[2].blend_id = "b02";
    expect(herbTiersPayload(input, true)).toHaveLength(2);
  });
});

describe("表示", () => {
  it("入力中の一行表示", () => {
    expect(describeHerbInput(createHerbInput("recommended"), catalog)).toBe("おすすめ（01 ＋ 02）");
    expect(describeHerbInput(createHerbInput("consult"), catalog)).toBe("当日スタッフと一緒に選ぶ");
    const input = createHerbInput("select");
    input.tiers[1].blend_id = "b01";
    input.tiers[2].blend_id = "b02";
    expect(describeHerbInput(input, catalog)).toBe("1段目 01 ＋ 2段目 02");
  });

  it("構成と段の短い表示", () => {
    expect(formatComposition([herbs.lemongrass, herbs.rosemary, herbs.sage])).toBe(
      "T レモングラス / M ローズマリー / B セージ"
    );
    expect(
      formatTierShort({ code: "07", title: "ORIGINAL", is_original: true, herbs: [herbs.lavender, herbs.agarwood] })
    ).toBe("07 ORIGINAL（ラベンダー・香木）");
  });

  it("保存済みの見出し。機能導入前は null", () => {
    expect(describeSavedHerbChoice(null, null)).toBeNull();
    expect(describeSavedHerbChoice("consult", null)).toBe("当日スタッフと一緒に選びます");
    expect(describeSavedHerbChoice("recommended", { tiers: [] })).toBe("おすすめ");
  });
});

describe("保存済みの内容", () => {
  const saved = {
    tiers: [
      { tier: 1, blend_id: "b01", code: "01", title: "Uの基本", is_original: false, needs_prep: false, caution: null, herbs: [herbs.lemongrass] },
      { tier: 2, blend_id: "b07", code: "07", title: "ORIGINAL", is_original: true, needs_prep: true, caution: null, herbs: [herbs.lavender, herbs.agarwood] },
    ],
  };

  it("変更画面の初期値に戻せる", () => {
    const input = herbInputFromReservation("select", saved);
    expect(input.choice).toBe("select");
    expect(input.tiers[1]).toEqual({ blend_id: "b01", herb_ids: [] });
    expect(input.tiers[2]).toEqual({ blend_id: "b07", herb_ids: [herbs.lavender.id, herbs.agarwood.id] });
  });

  it("仕込みが要るブレンドを含むか", () => {
    expect(selectionNeedsPrep(saved)).toBe(true);
    expect(selectionNeedsPrep(JSON.stringify({ tiers: [saved.tiers[0]] }))).toBe(false);
    expect(selectionNeedsPrep(null)).toBe(false);
  });
});

describe("canCustomerChangeHerbs", () => {
  it("前日24時まで（今日が利用日より前）", () => {
    expect(canCustomerChangeHerbs("2026-11-03", "2026-11-02", "confirmed")).toBe(true);
    expect(canCustomerChangeHerbs("2026-11-03", "2026-11-03", "confirmed")).toBe(false);
    expect(canCustomerChangeHerbs("2026-11-03", "2026-11-01", "pending")).toBe(true);
    expect(canCustomerChangeHerbs("2026-11-03", "2026-11-01", "cancelled")).toBe(false);
    expect(canCustomerChangeHerbs("2026-11-03", "2026-11-01", "pending_payment")).toBe(false);
  });
});
