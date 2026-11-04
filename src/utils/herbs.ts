// ハーブ蒸しのブレンド選択。
// 予約には選び方(herb_choice)と予約時点の中身(herb_selection: スナップショット)を保存する。
// 検証とスナップショット作成は DB 関数 build_herb_selection()。ここは入力状態と表示の整形だけ。
// メール・LINE 側の表示は supabase/functions/_shared/herb.ts（表記を揃えること）。

export type HerbChoice = "select" | "recommended" | "consult";
export type HerbNote = "top" | "middle" | "base";
export type HerbTierNumber = 1 | 2;

export const HERB_CHOICES: HerbChoice[] = ["select", "recommended", "consult"];
export const HERB_TIERS: HerbTierNumber[] = [1, 2];
export const HERB_NOTES: HerbNote[] = ["top", "middle", "base"];
/** 07 ORIGINAL で選べるハーブの上限 */
export const ORIGINAL_MAX_HERBS = 3;

export const HERB_CHOICE_LABELS: Record<HerbChoice, string> = {
  select: "事前に選ぶ",
  recommended: "おすすめ",
  consult: "当日スタッフと一緒に選ぶ",
};

export const HERB_NOTE_LABELS: Record<HerbNote, string> = { top: "TOP", middle: "MIDDLE", base: "BASE" };
export const HERB_NOTE_SHORT: Record<HerbNote, string> = { top: "T", middle: "M", base: "B" };
export const HERB_NOTE_DESCRIPTIONS: Record<HerbNote, string> = {
  top: "最初に立ち上がり、早く消える香り",
  middle: "香りの中心になり、しばらく続く香り",
  base: "ゆっくり立ち、最後まで残る香り",
};

/** 予約画面・受付で案内する注意書き */
export const HERB_SAFETY_NOTE = "植物アレルギーのある方・妊娠中の方は、当日スタッフにお知らせください";

export interface HerbRef {
  id: string;
  name: string;
  note: HerbNote;
}

export interface CatalogBlend {
  id: string;
  code: string;
  title: string;
  description: string | null;
  caution: string | null;
  is_original: boolean;
  needs_prep: boolean;
  /** 有効かつ構成ハーブがすべて有効（在庫切れなら false） */
  available: boolean;
  herbs: HerbRef[];
}

export interface HerbCatalog {
  herbs: HerbRef[];
  blends: CatalogBlend[];
  recommended: { tier1_blend_id: string | null; tier2_blend_id: string | null; available: boolean } | null;
}

export interface HerbTierInput {
  blend_id: string | null;
  /** ORIGINAL のときだけ使う */
  herb_ids: string[];
}

/** 予約フォーム・マイページ・管理画面の入力状態 */
export interface HerbInput {
  choice: HerbChoice;
  tiers: Record<HerbTierNumber, HerbTierInput>;
}

/** 予約に保存されたスナップショット（予約時点の内容） */
export interface HerbTierSnapshot {
  tier: number;
  blend_id: string;
  code: string;
  title: string;
  is_original: boolean;
  needs_prep: boolean;
  caution: string | null;
  herbs: HerbRef[];
}

export interface HerbSelection {
  tiers: HerbTierSnapshot[];
}

const emptyTier = (): HerbTierInput => ({ blend_id: null, herb_ids: [] });

export const createHerbInput = (choice: HerbChoice): HerbInput => ({
  choice,
  tiers: { 1: emptyTier(), 2: emptyTier() },
});

export const isHerbChoice = (v: unknown): v is HerbChoice =>
  typeof v === "string" && (HERB_CHOICES as string[]).includes(v);

export const parseHerbSelection = (raw: unknown): HerbSelection | null => {
  if (!raw) return null;
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return value && Array.isArray((value as HerbSelection).tiers) ? (value as HerbSelection) : null;
  } catch {
    return null;
  }
};

/** 保存済みの内容から入力状態を作る（変更画面の初期値） */
export const herbInputFromReservation = (choice: unknown, rawSelection: unknown): HerbInput => {
  const input = createHerbInput(isHerbChoice(choice) ? choice : "consult");
  const selection = parseHerbSelection(rawSelection);
  for (const t of selection?.tiers ?? []) {
    if (t.tier === 1 || t.tier === 2) {
      input.tiers[t.tier] = { blend_id: t.blend_id, herb_ids: t.is_original ? t.herbs.map((h) => h.id) : [] };
    }
  }
  return input;
};

export const findBlend = (catalog: HerbCatalog | undefined, blendId: string | null) =>
  blendId ? catalog?.blends.find((b) => b.id === blendId) : undefined;

/** 1段分の入力が揃っているか（ORIGINAL は 1〜3 種） */
export const isTierComplete = (tier: HerbTierInput, catalog: HerbCatalog | undefined) => {
  const blend = findBlend(catalog, tier.blend_id);
  if (!blend || !blend.available) return false;
  return !blend.is_original || (tier.herb_ids.length >= 1 && tier.herb_ids.length <= ORIGINAL_MAX_HERBS);
};

/** 送信できる状態か。事前に選ぶ場合だけ 1段目・2段目の両方が必要 */
export const isHerbInputComplete = (input: HerbInput, catalog: HerbCatalog | undefined) =>
  input.choice !== "select" || HERB_TIERS.every((t) => isTierComplete(input.tiers[t], catalog));

/** API に送る段指定。おすすめ・当日（お客様）は送らない */
export const herbTiersPayload = (input: HerbInput, includeForConsult = false) =>
  input.choice === "select" || (includeForConsult && input.choice === "consult")
    ? HERB_TIERS.filter((t) => input.tiers[t].blend_id).map((t) => ({
        tier: t,
        blend_id: input.tiers[t].blend_id,
        herb_ids: input.tiers[t].herb_ids,
      }))
    : [];

/** "T レモングラス / M ローズマリー / B セージ" */
export const formatComposition = (herbs: HerbRef[]) =>
  herbs.map((h) => `${HERB_NOTE_SHORT[h.note] ?? ""} ${h.name}`.trim()).join(" / ");

/** "01 Uの基本"。ORIGINAL は選んだハーブも添える "07 ORIGINAL（ラベンダー・香木）" */
export const formatTierShort = (tier: Pick<HerbTierSnapshot, "code" | "title" | "is_original" | "herbs">) =>
  tier.is_original && tier.herbs.length > 0
    ? `${tier.code} ${tier.title}（${tier.herbs.map((h) => h.name).join("・")}）`
    : `${tier.code} ${tier.title}`;

/** 入力中の1段をスナップショットと同じ形にする（表示用） */
export const tierPreview = (tier: HerbTierInput, catalog: HerbCatalog | undefined) => {
  const blend = findBlend(catalog, tier.blend_id);
  if (!blend) return null;
  const herbs = blend.is_original
    ? (catalog?.herbs ?? [])
        .filter((h) => tier.herb_ids.includes(h.id))
        .sort((a, b) => HERB_NOTES.indexOf(a.note) - HERB_NOTES.indexOf(b.note))
    : blend.herbs;
  return { code: blend.code, title: blend.title, is_original: blend.is_original, needs_prep: blend.needs_prep, herbs };
};

/** おすすめの組み合わせ（予約画面のカードに添える） */
export const recommendedTiers = (catalog: HerbCatalog | undefined) => {
  const rec = catalog?.recommended;
  if (!rec) return null;
  const t1 = findBlend(catalog, rec.tier1_blend_id);
  const t2 = findBlend(catalog, rec.tier2_blend_id);
  return t1 && t2 ? { tier1: t1, tier2: t2, available: rec.available } : null;
};

/** 入力中の内容の一行表示（予約サマリー・確認ダイアログ） */
export const describeHerbInput = (input: HerbInput, catalog: HerbCatalog | undefined): string => {
  if (input.choice === "consult") return "当日スタッフと一緒に選ぶ";
  if (input.choice === "recommended") {
    const rec = recommendedTiers(catalog);
    return rec ? `おすすめ（${rec.tier1.code} ＋ ${rec.tier2.code}）` : "おすすめ";
  }
  const parts = HERB_TIERS.map((t) => tierPreview(input.tiers[t], catalog));
  return parts.every(Boolean)
    ? `1段目 ${parts[0]!.code} ＋ 2段目 ${parts[1]!.code}`
    : "事前に選ぶ（選択中）";
};

/**
 * 保存済みの内容の見出し。null は機能導入前の予約
 *   おすすめ / 事前に選ぶ / 当日スタッフと一緒に選びます / 当日に決定
 */
export const describeSavedHerbChoice = (choice: unknown, rawSelection: unknown): string | null => {
  if (!isHerbChoice(choice)) return null;
  const selection = parseHerbSelection(rawSelection);
  if (choice === "consult") return selection ? "当日スタッフと一緒に決定" : "当日スタッフと一緒に選びます";
  return HERB_CHOICE_LABELS[choice];
};

/** 仕込みに手間がかかるブレンド（06・07）を含むか */
export const selectionNeedsPrep = (rawSelection: unknown) =>
  parseHerbSelection(rawSelection)?.tiers.some((t) => t.needs_prep) ?? false;

/** マイページから変更できるのは利用日の前日24時(JST)まで = 今日が利用日より前 */
export const canCustomerChangeHerbs = (reservationDate: string, todayYmd: string, status: string) =>
  (status === "confirmed" || status === "pending") && todayYmd < reservationDate;

const HERB_ERROR_MESSAGES: Record<string, string> = {
  herb_blend_unavailable: "選んだブレンドは在庫切れなどで選べません",
  herb_original_invalid: "ORIGINALはハーブを1〜3種選んでください",
  herb_tiers_required: "1段目と2段目のブレンドを両方選んでください",
  herb_recommended_unavailable: "おすすめに選べないブレンドが含まれています（ハーブ設定を確認してください）",
  herb_choice_invalid: "選び方の指定が正しくありません",
  forbidden: "この操作をする権限がありません",
  reservation_not_found: "予約が見つかりません",
};

/** DB 関数(build_herb_selection / admin_set_reservation_herbs)の例外を日本語にする */
export const herbErrorMessage = (error: unknown): string => {
  const message =
    error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : String(error);
  const key = Object.keys(HERB_ERROR_MESSAGES).find((k) => message.includes(k));
  return key ? HERB_ERROR_MESSAGES[key] : "ハーブの保存に失敗しました";
};
