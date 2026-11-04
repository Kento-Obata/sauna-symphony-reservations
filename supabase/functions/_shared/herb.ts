// ハーブ蒸しのブレンド選択（予約の herb_choice / herb_selection）を扱う共通処理。
// 検証とスナップショット作成は DB 関数 build_herb_selection() が行う。ここでは入力の整形、
// エラーの日本語化、メール・スタッフ LINE 向けの表示文を作る。
// フロントの src/utils/herbs.ts と表示ルールを揃えること。

export type HerbChoice = "select" | "recommended" | "consult";

export const HERB_CHOICES: HerbChoice[] = ["select", "recommended", "consult"];

export const HERB_CHOICE_LABELS: Record<HerbChoice, string> = {
  select: "事前に選ぶ",
  recommended: "おすすめ",
  consult: "当日スタッフと一緒に選ぶ",
};

const NOTE_SHORT: Record<string, string> = { top: "T", middle: "M", base: "B" };

export interface HerbTierPayload {
  tier: 1 | 2;
  blend_id: string;
  herb_ids: string[];
}

interface SnapshotHerb {
  id: string;
  name: string;
  note: string;
}

interface SnapshotTier {
  tier: number;
  code: string;
  title: string;
  is_original: boolean;
  needs_prep: boolean;
  herbs: SnapshotHerb[];
}

export interface HerbSelection {
  tiers: SnapshotTier[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isHerbChoice = (v: unknown): v is HerbChoice =>
  typeof v === "string" && (HERB_CHOICES as string[]).includes(v);

/**
 * リクエストの段指定を整形する。形式が不正なら null（DB に渡すと uuid のキャストで 500 になるため先に弾く）。
 * 中身の妥当性（選べるブレンドか・ORIGINAL の種類数）は DB 側で検証する。
 */
export const normalizeHerbTiers = (raw: unknown): HerbTierPayload[] | null => {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > 2) return null;
  const tiers: HerbTierPayload[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { tier, blend_id, herb_ids } = item as Record<string, unknown>;
    if ((tier !== 1 && tier !== 2) || typeof blend_id !== "string" || !UUID_RE.test(blend_id)) return null;
    const ids = herb_ids === undefined || herb_ids === null ? [] : herb_ids;
    if (!Array.isArray(ids) || ids.length > 3 || !ids.every((id) => typeof id === "string" && UUID_RE.test(id))) {
      return null;
    }
    tiers.push({ tier, blend_id, herb_ids: ids as string[] });
  }
  return tiers;
};

const HERB_ERROR_MESSAGES: Record<string, string> = {
  herb_blend_unavailable: "選んだブレンドは、ただいまご用意できません　別のブレンドをお選びください",
  herb_original_invalid: "ORIGINALは、ハーブを1〜3種お選びください",
  herb_tiers_required: "1段目と2段目のブレンドをお選びください",
  herb_recommended_unavailable: "おすすめは、ただいまご用意できません　別の選び方をお選びください",
  herb_choice_invalid: "ハーブの選び方の指定が正しくありません",
};

/** DB 関数の例外（P0001 のメッセージ）をお客様向けの文に変換する。ハーブ以外のエラーは null */
export const herbErrorMessage = (error: unknown): string | null => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const key = Object.keys(HERB_ERROR_MESSAGES).find((k) => message.includes(k));
  return key ? HERB_ERROR_MESSAGES[key] : null;
};

const asSelection = (raw: unknown): HerbSelection | null => {
  if (!raw) return null;
  const value = typeof raw === "string" ? JSON.parse(raw) : raw;
  return value && Array.isArray((value as HerbSelection).tiers) ? (value as HerbSelection) : null;
};

/** "T レモングラス / M ローズマリー / B セージ" */
const formatComposition = (herbs: SnapshotHerb[]) =>
  herbs.map((h) => `${NOTE_SHORT[h.note] ?? ""} ${h.name}`.trim()).join(" / ");

/** "01 Uの基本" / ORIGINAL は選んだハーブも添える "07 ORIGINAL（ラベンダー・香木）" */
const formatTierShort = (t: SnapshotTier) =>
  t.is_original ? `${t.code} ${t.title}（${t.herbs.map((h) => h.name).join("・")}）` : `${t.code} ${t.title}`;

/**
 * お客様向けメールの「ハーブ蒸し」欄。herb_choice が無い（機能導入前の予約）なら null
 */
export const formatHerbEmailBlock = (choice: unknown, rawSelection: unknown): string | null => {
  if (!isHerbChoice(choice)) return null;
  const selection = asSelection(rawSelection);
  const lines = ["【ハーブ蒸し】"];
  if (!selection) {
    lines.push("当日スタッフと一緒に選びます");
  } else {
    lines.push(`選び方: ${HERB_CHOICE_LABELS[choice]}`);
    for (const t of selection.tiers) {
      lines.push(`${t.tier}段目: ${t.code} ${t.title}（${formatComposition(t.herbs)}）`);
    }
  }
  return lines.join("\n");
};

/**
 * スタッフ LINE の1行。仕込みが要るブレンド（06・07）と、受付での相談が要る予約を目立たせる
 */
export const formatHerbStaffLine = (choice: unknown, rawSelection: unknown): string | null => {
  if (!isHerbChoice(choice)) return null;
  const selection = asSelection(rawSelection);
  if (!selection) return "🌿 当日相談（受付で一緒に選ぶ）";
  const label = choice === "recommended" ? "おすすめ" : choice === "consult" ? "当日決定" : "事前";
  const body = selection.tiers.map(formatTierShort).join(" ＋ ");
  const prep = selection.tiers.some((t) => t.needs_prep) ? " ⚠仕込み" : "";
  return `🌿 ${label} ${body}${prep}`;
};
