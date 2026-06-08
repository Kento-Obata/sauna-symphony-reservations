// JST 日付ユーティリティ。Date オブジェクトを一切経由せず "YYYY-MM-DD" 文字列を直接扱う。
//
// なぜ専用ユーティリティが必要か:
//   過去にあったバグ: new Date("2026-06-13T00:00:00+09:00").getUTCDay() は UTC に
//   変換された結果(2026-06-12 15:00)の曜日(金)を返す。「JST 日付 → Date → getUTCDay」
//   というパターンは常に 1 日ズレるため危険。
//   ここでは Zeller の公式で文字列のまま曜日を計算するので TZ バグが構造的に発生しない。
//
// ルール:
//   - サーバ(edge function)側で曜日判定が必要な箇所は必ずこのファイルの関数を使う。
//   - 直接 getUTCDay() / getDay() を呼ぶことは ESLint で禁止 (eslint.config.js)。

import jpHolidays from "https://esm.sh/japanese-holidays@1.0.10";

const isJpHolidayRaw: (d: Date) => unknown =
  (jpHolidays as any)?.isHoliday ??
  (jpHolidays as any)?.default?.isHoliday ??
  (() => false);

/** "YYYY-MM-DD" → 0(日)〜6(土)。Zeller の公式。TZ非依存。 */
export const getJstDayOfWeek = (ymd: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) throw new Error(`Invalid YYYY-MM-DD: ${ymd}`);
  let y = Number(m[1]);
  let mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 3) {
    mo += 12;
    y -= 1;
  }
  const K = y % 100;
  const J = Math.floor(y / 100);
  // Zeller: h = (d + floor(13(m+1)/5) + K + floor(K/4) + floor(J/4) + 5J) mod 7
  // h: 0=土,1=日,2=月,...,6=金
  const h = (d + Math.floor((13 * (mo + 1)) / 5) + K + Math.floor(K / 4) + Math.floor(J / 4) + 5 * J) % 7;
  // 0=日〜6=土 に変換
  return (h + 6) % 7;
};

/** "YYYY-MM-DD" が土曜または日曜か。 */
export const isJstWeekend = (ymd: string): boolean => {
  const dow = getJstDayOfWeek(ymd);
  return dow === 0 || dow === 6;
};

/** "YYYY-MM-DD" が日本の祝日か。japanese-holidays は getMonth/getDate を使うので UTC 0 時の Date でも JST 暦日として正しく扱える。 */
export const isJstHoliday = (ymd: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return !!isJpHolidayRaw(d);
};

export const isJstWeekendOrHoliday = (ymd: string): boolean =>
  isJstWeekend(ymd) || isJstHoliday(ymd);
