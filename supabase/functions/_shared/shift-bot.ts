// LINE bot のシフト系コマンド: テキスト → コマンド構造体のパース、および返信テキストの整形。
// DB に触らない純粋関数のみ（テストは shift-bot_test.ts）。DB 操作は shift-service.ts。
//
// コマンド仕様は docs/line-shift-bot.md を参照。

import { addJstDays, formatMdWithWeekday, formatYmdWithWeekday, getJstDayOfWeek } from "./date-jst.ts";

export type ShiftCommand =
  | { kind: "help" }
  | { kind: "list"; date: string }
  | { kind: "list_range"; from: string; to: string; label: string }
  | { kind: "mine" }
  | {
    kind: "add";
    date: string;
    start: string;
    end: string;
    breakMinutes: number | null;
    staffName: string | null;
  }
  | {
    kind: "update";
    date: string;
    start: string;
    end: string;
    breakMinutes: number | null;
    staffName: string | null;
  }
  | { kind: "delete"; date: string; staffName: string | null }
  | { kind: "error"; message: string };

/** DB から取り出したシフト 1 件（時刻は JST の "HH:MM"、date は JST の "YYYY-MM-DD"）。 */
export interface ShiftRow {
  id: string;
  staff_id: string;
  username: string;
  date: string;
  start: string;
  end: string;
  break_minutes: number;
}

export const SHIFT_HELP_TEXT = [
  "👷 シフトコマンド",
  "",
  "▼ 確認",
  "・シフト            → 今日のシフト",
  "・シフト 明日 / シフト 10/3",
  "・シフト 今週 / シフト 来週",
  "・マイシフト        → 自分の今後2週間",
  "",
  "▼ 自分のシフトを操作",
  "・シフト追加 10/3 14:30-22:00 休憩60",
  "・シフト変更 10/3 15:00-22:00",
  "・シフト削除 10/3",
  "",
  "▼ 管理者は名前を付けて他の人も操作可",
  "・シフト追加 稲垣 10/3 14:30-22:00",
  "・シフト変更 稲垣 10/3 15:00-22:00 休憩30",
  "・シフト削除 稲垣 10/3",
  "",
  "※ 日付は 10/3 / 2026-10-03 / 今日 / 明日 / 明後日",
  "※ 時刻は 14:30 / 14 / 1430 のいずれも可",
  "※ 変更・削除はその日にシフトが1件のときのみ",
].join("\n");

// ---------------------------------------------------------------------------
// 正規化・トークン化
// ---------------------------------------------------------------------------

const RANGE_SEP = /[~〜～−–]/g;

/** 全角英数・記号を半角へ寄せ、範囲区切りを "~" に統一する。 */
export const normalizeText = (s: string): string =>
  s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/：/g, ":")
    .replace(/／/g, "/")
    .replace(/－/g, "-")
    .replace(RANGE_SEP, "~")
    .replace(/\u3000/g, " ")
    .trim();

const isSepToken = (t: string) => t === "-" || t === "~";

/**
 * "14:30 - 22:00" や "14:30-" "22:00" のように分かれた範囲を 1 トークンに寄せる。
 * "休憩 60" も "休憩60" に寄せる。
 */
export const mergeTokens = (tokens: string[]): string[] => {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const prev = out[out.length - 1];
    if (isSepToken(t) && prev !== undefined && i + 1 < tokens.length) {
      out[out.length - 1] = `${prev}~${tokens[i + 1]}`;
      i++;
      continue;
    }
    if (prev !== undefined && /[-~]$/.test(prev) && !isSepToken(t)) {
      out[out.length - 1] = `${prev.slice(0, -1)}~${t}`;
      continue;
    }
    if (/^[-~]/.test(t) && prev !== undefined && t.length > 1) {
      out[out.length - 1] = `${prev}~${t.slice(1)}`;
      continue;
    }
    if (prev === "休憩" && /^\d{1,3}(分)?$/.test(t)) {
      out[out.length - 1] = `休憩${t}`;
      continue;
    }
    out.push(t);
  }
  return out;
};

// ---------------------------------------------------------------------------
// 日付・時刻
// ---------------------------------------------------------------------------

const pad2 = (n: number) => String(n).padStart(2, "0");

const isValidYmd = (y: number, m: number, d: number): boolean => {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

/**
 * 日付トークン → "YYYY-MM-DD"。解釈不能なら null。
 *  - 今日 / 明日 / 明後日
 *  - M/D, M月D日 → 当年。30日以上過去なら翌年扱い
 *  - YYYY-MM-DD, YYYY/M/D
 */
export const parseDateToken = (token: string, today: string): string | null => {
  const t = token.trim();
  if (t === "今日" || t === "きょう") return today;
  if (t === "明日" || t === "あした") return addJstDays(today, 1);
  if (t === "明後日" || t === "あさって") return addJstDays(today, 2);

  const full = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(t);
  if (full) {
    const [y, m, d] = [Number(full[1]), Number(full[2]), Number(full[3])];
    return isValidYmd(y, m, d) ? `${y}-${pad2(m)}-${pad2(d)}` : null;
  }

  const md = /^(\d{1,2})(?:\/|月)(\d{1,2})日?$/.exec(t);
  if (md) {
    const [m, d] = [Number(md[1]), Number(md[2])];
    const year = Number(today.slice(0, 4));
    if (!isValidYmd(year, m, d)) return null;
    const candidate = `${year}-${pad2(m)}-${pad2(d)}`;
    const diffDays = (Date.parse(`${candidate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
    if (diffDays < -30) return `${year + 1}-${pad2(m)}-${pad2(d)}`;
    return candidate;
  }
  return null;
};

/** 時刻トークン → "HH:MM"。"14:30" / "14" / "1430" / "9:00" を許容。 */
export const parseTimeToken = (token: string): string | null => {
  const t = token.trim();
  let h: number, m: number;
  const hm = /^(\d{1,2}):(\d{2})$/.exec(t);
  const hhmm = /^(\d{2})(\d{2})$/.exec(t);
  const hOnly = /^(\d{1,2})$/.exec(t);
  if (hm) [h, m] = [Number(hm[1]), Number(hm[2])];
  else if (hhmm) [h, m] = [Number(hhmm[1]), Number(hhmm[2])];
  else if (hOnly) [h, m] = [Number(hOnly[1]), 0];
  else return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${pad2(h)}:${pad2(m)}`;
};

/** "14:30~22:00" → { start, end }。 */
export const parseTimeRange = (token: string): { start: string; end: string } | null => {
  // "14:30-22:00" / "14:30~22:00"（normalizeText で 〜～−– は ~ に統一済み）
  const parts = token.split(/[-~]/);
  if (parts.length !== 2) return null;
  const start = parseTimeToken(parts[0]);
  const end = parseTimeToken(parts[1]);
  if (!start || !end) return null;
  return { start, end };
};

export const parseBreakToken = (token: string): number | null => {
  const m = /^休憩(\d{1,3})分?$/.exec(token);
  return m ? Number(m[1]) : null;
};

/** 月曜始まりの週 [from, to]。offsetWeeks=1 で来週。 */
export const weekRange = (today: string, offsetWeeks = 0): { from: string; to: string } => {
  const dow = getJstDayOfWeek(today); // 0=日
  const monday = addJstDays(today, -((dow + 6) % 7) + offsetWeeks * 7);
  return { from: monday, to: addJstDays(monday, 6) };
};

// ---------------------------------------------------------------------------
// パース
// ---------------------------------------------------------------------------

const ACTION_WORDS: Record<string, "add" | "update" | "delete" | "help" | "list"> = {
  追加: "add",
  登録: "add",
  変更: "update",
  修正: "update",
  削除: "delete",
  取消: "delete",
  キャンセル: "delete",
  ヘルプ: "help",
  一覧: "list",
};

/**
 * テキストをシフトコマンドとして解釈する。シフト系でなければ null。
 * 文法的にシフト系だが引数不正なら { kind: "error" } を返す（ユーザーへ案内するため）。
 */
export const parseShiftCommand = (text: string, today: string): ShiftCommand | null => {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  // 「マイシフト」「自分のシフト」
  if (/^(マイシフト|自分のシフト|シフト\s*自分)$/.test(normalized)) return { kind: "mine" };

  // 「シフト」で始まらなければ対象外
  if (!/^シフト/.test(normalized)) return null;

  // 「シフト追加 ...」「シフト 追加 ...」の両方を許容
  const rest = normalized.replace(/^シフト\s*/, "");
  let tokens = mergeTokens(rest.split(/\s+/).filter(Boolean));

  let action: "add" | "update" | "delete" | "help" | "list" = "list";
  if (tokens.length > 0 && ACTION_WORDS[tokens[0]]) {
    action = ACTION_WORDS[tokens[0]];
    tokens = tokens.slice(1);
  }

  if (action === "help") return { kind: "help" };

  if (action === "list") {
    if (tokens.length === 0) return { kind: "list", date: today };
    if (tokens.length === 1) {
      const t = tokens[0];
      if (t === "今週") return { kind: "list_range", ...weekRange(today, 0), label: "今週" };
      if (t === "来週") return { kind: "list_range", ...weekRange(today, 1), label: "来週" };
      const date = parseDateToken(t, today);
      if (date) return { kind: "list", date };
      return { kind: "error", message: `日付を解釈できません: ${t}\n例: シフト 10/3 / シフト 明日 / シフト 今週` };
    }
    return { kind: "error", message: "引数が多すぎます。\n例: シフト 10/3 / シフト 今週" };
  }

  // add / update / delete: [名前] 日付 [開始~終了] [休憩N]
  let staffName: string | null = null;
  let date: string | null = null;
  let range: { start: string; end: string } | null = null;
  let breakMinutes: number | null = null;

  for (const t of tokens) {
    if (date === null) {
      const d = parseDateToken(t, today);
      if (d) {
        date = d;
        continue;
      }
      if (staffName === null && !/^\d/.test(t) && !t.includes("~")) {
        staffName = t;
        continue;
      }
      return { kind: "error", message: `日付を解釈できません: ${t}\n例: シフト${labelOf(action)} 10/3 14:30-22:00` };
    }
    const r = parseTimeRange(t);
    if (r && range === null) {
      range = r;
      continue;
    }
    const b = parseBreakToken(t);
    if (b !== null) {
      breakMinutes = b;
      continue;
    }
    return { kind: "error", message: `引数を解釈できません: ${t}\n例: シフト${labelOf(action)} 10/3 14:30-22:00 休憩60` };
  }

  if (!date) {
    return { kind: "error", message: `日付を指定してください。\n例: シフト${labelOf(action)} 10/3${action === "delete" ? "" : " 14:30-22:00"}` };
  }

  if (action === "delete") {
    if (range) return { kind: "error", message: "削除には時刻は不要です。\n例: シフト削除 10/3" };
    return { kind: "delete", date, staffName };
  }

  if (!range) {
    return { kind: "error", message: `時間を指定してください。\n例: シフト${labelOf(action)} 10/3 14:30-22:00` };
  }
  if (range.end <= range.start) {
    return { kind: "error", message: `終了時刻は開始より後にしてください: ${range.start}-${range.end}` };
  }
  if (breakMinutes !== null && breakMinutes > 600) {
    return { kind: "error", message: `休憩時間が大きすぎます: ${breakMinutes}分` };
  }

  return { kind: action, date, start: range.start, end: range.end, breakMinutes, staffName };
};

const labelOf = (action: "add" | "update" | "delete"): string =>
  action === "add" ? "追加" : action === "update" ? "変更" : "削除";

// ---------------------------------------------------------------------------
// 整形
// ---------------------------------------------------------------------------

export const formatTimeRange = (r: { start: string; end: string; break_minutes: number }): string =>
  `${r.start}-${r.end}${r.break_minutes > 0 ? `（休憩${r.break_minutes}分）` : ""}`;

/** 1 行表記: "・稲垣 14:30-22:00（休憩60分）" */
export const formatShiftLine = (r: ShiftRow): string => `・${r.username} ${formatTimeRange(r)}`;

export const formatShiftsForDate = (date: string, rows: ShiftRow[]): string => {
  const header = `👷 ${formatYmdWithWeekday(date)} のシフト`;
  if (rows.length === 0) return `${header}\n登録なし`;
  return [`${header} ${rows.length}件`, ...rows.map(formatShiftLine)].join("\n");
};

export const formatShiftsForRange = (label: string, from: string, to: string, rows: ShiftRow[]): string => {
  const lines = [`👷 ${label}のシフト (${formatMdWithWeekday(from)}〜${formatMdWithWeekday(to)})`, ""];
  for (let d = from; d <= to; d = addJstDays(d, 1)) {
    const dayRows = rows.filter((r) => r.date === d);
    lines.push(`${formatMdWithWeekday(d)}`);
    if (dayRows.length === 0) lines.push("  （なし）");
    else for (const r of dayRows) lines.push(`  ${formatShiftLine(r)}`);
  }
  return lines.join("\n");
};

export const formatMyShifts = (username: string, from: string, to: string, rows: ShiftRow[]): string => {
  const header = `👤 ${username}さんのシフト (${formatMdWithWeekday(from)}〜${formatMdWithWeekday(to)})`;
  if (rows.length === 0) return `${header}\n登録なし`;
  return [header, ...rows.map((r) => `・${formatMdWithWeekday(r.date)} ${formatTimeRange(r)}`)].join("\n");
};

/** 日次 push 用: 当日シフトのブロック。 */
export const formatDailyShiftBlock = (rows: ShiftRow[]): string => {
  if (rows.length === 0) return "👷 本日のシフト\n登録なし";
  return ["👷 本日のシフト", ...rows.map(formatShiftLine)].join("\n");
};
