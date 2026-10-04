import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  formatDailyShiftBlock,
  formatShiftsForDate,
  formatShiftsForRange,
  mergeTokens,
  normalizeText,
  parseDateToken,
  parseShiftCommand,
  parseTimeToken,
  weekRange,
  type ShiftRow,
} from "./shift-bot.ts";
import { addJstDays, formatMdWithWeekday } from "./date-jst.ts";

const TODAY = "2026-09-29"; // 火

Deno.test("addJstDays: 月末・年末をまたぐ", () => {
  assertEquals(addJstDays("2026-09-30", 1), "2026-10-01");
  assertEquals(addJstDays("2026-12-31", 1), "2027-01-01");
  assertEquals(addJstDays("2026-10-01", -1), "2026-09-30");
});

Deno.test("formatMdWithWeekday", () => {
  assertEquals(formatMdWithWeekday("2026-09-29"), "9/29 (火)");
  assertEquals(formatMdWithWeekday("2026-10-03"), "10/3 (土)");
});

Deno.test("normalizeText: 全角→半角、範囲区切り統一", () => {
  assertEquals(normalizeText("シフト追加　１０／３　１４：３０〜２２：００"), "シフト追加 10/3 14:30~22:00");
  assertEquals(normalizeText("シフト変更 10/3 15:00－22:00"), "シフト変更 10/3 15:00-22:00");
});

Deno.test("mergeTokens: 分かれた範囲・休憩を寄せる", () => {
  assertEquals(mergeTokens(["14:30", "-", "22:00"]), ["14:30~22:00"]);
  assertEquals(mergeTokens(["14:30-", "22:00"]), ["14:30~22:00"]);
  assertEquals(mergeTokens(["14:30", "-22:00"]), ["14:30~22:00"]);
  assertEquals(mergeTokens(["休憩", "60"]), ["休憩60"]);
  assertEquals(mergeTokens(["10/3", "14:30~22:00"]), ["10/3", "14:30~22:00"]);
});

Deno.test("parseDateToken: 各形式", () => {
  assertEquals(parseDateToken("今日", TODAY), "2026-09-29");
  assertEquals(parseDateToken("明日", TODAY), "2026-09-30");
  assertEquals(parseDateToken("明後日", TODAY), "2026-10-01");
  assertEquals(parseDateToken("10/3", TODAY), "2026-10-03");
  assertEquals(parseDateToken("10月3日", TODAY), "2026-10-03");
  assertEquals(parseDateToken("2026-10-03", TODAY), "2026-10-03");
  assertEquals(parseDateToken("2026/10/3", TODAY), "2026-10-03");
  // 30日以上過去の M/D は翌年
  assertEquals(parseDateToken("1/5", TODAY), "2027-01-05");
  assertEquals(parseDateToken("2/30", TODAY), null);
  assertEquals(parseDateToken("14:30", TODAY), null);
});

Deno.test("parseTimeToken: 各形式", () => {
  assertEquals(parseTimeToken("14:30"), "14:30");
  assertEquals(parseTimeToken("9:00"), "09:00");
  assertEquals(parseTimeToken("14"), "14:00");
  assertEquals(parseTimeToken("1430"), "14:30");
  assertEquals(parseTimeToken("24:00"), null);
  assertEquals(parseTimeToken("abc"), null);
});

Deno.test("weekRange: 月曜始まり", () => {
  assertEquals(weekRange(TODAY, 0), { from: "2026-09-28", to: "2026-10-04" });
  assertEquals(weekRange(TODAY, 1), { from: "2026-10-05", to: "2026-10-11" });
  assertEquals(weekRange("2026-10-04", 0), { from: "2026-09-28", to: "2026-10-04" }); // 日曜
});

Deno.test("parseShiftCommand: シフト系でないテキストは null", () => {
  assertEquals(parseShiftCommand("今日", TODAY), null);
  assertEquals(parseShiftCommand("R-ABCD1234", TODAY), null);
  assertEquals(parseShiftCommand("おはよう", TODAY), null);
  assertEquals(parseShiftCommand("シフトの件どうする？", TODAY)?.kind, "error");
});

Deno.test("parseShiftCommand: 一覧", () => {
  assertEquals(parseShiftCommand("シフト", TODAY), { kind: "list", date: "2026-09-29" });
  assertEquals(parseShiftCommand("シフト 明日", TODAY), { kind: "list", date: "2026-09-30" });
  assertEquals(parseShiftCommand("シフト 10/3", TODAY), { kind: "list", date: "2026-10-03" });
  assertEquals(parseShiftCommand("シフト一覧 10/3", TODAY), { kind: "list", date: "2026-10-03" });
  assertEquals(parseShiftCommand("シフト 今週", TODAY), {
    kind: "list_range",
    from: "2026-09-28",
    to: "2026-10-04",
    label: "今週",
  });
  assertEquals(parseShiftCommand("シフト 来週", TODAY)?.kind, "list_range");
  assertEquals(parseShiftCommand("マイシフト", TODAY), { kind: "mine" });
  assertEquals(parseShiftCommand("シフト ヘルプ", TODAY), { kind: "help" });
});

Deno.test("parseShiftCommand: 追加（自分）", () => {
  assertEquals(parseShiftCommand("シフト追加 10/3 14:30-22:00 休憩60", TODAY), {
    kind: "add",
    date: "2026-10-03",
    start: "14:30",
    end: "22:00",
    breakMinutes: 60,
    staffName: null,
  });
  assertEquals(parseShiftCommand("シフト 追加 明日 14〜22", TODAY), {
    kind: "add",
    date: "2026-09-30",
    start: "14:00",
    end: "22:00",
    breakMinutes: null,
    staffName: null,
  });
  assertEquals(parseShiftCommand("シフト追加 10/3 14:30 - 22:00 休憩 30", TODAY), {
    kind: "add",
    date: "2026-10-03",
    start: "14:30",
    end: "22:00",
    breakMinutes: 30,
    staffName: null,
  });
});

Deno.test("parseShiftCommand: 変更・削除（名前指定）", () => {
  assertEquals(parseShiftCommand("シフト変更 稲垣 10/3 15:00-22:00", TODAY), {
    kind: "update",
    date: "2026-10-03",
    start: "15:00",
    end: "22:00",
    breakMinutes: null,
    staffName: "稲垣",
  });
  assertEquals(parseShiftCommand("シフト削除 稲垣 10/3", TODAY), {
    kind: "delete",
    date: "2026-10-03",
    staffName: "稲垣",
  });
  assertEquals(parseShiftCommand("シフト削除 10/3", TODAY), {
    kind: "delete",
    date: "2026-10-03",
    staffName: null,
  });
});

Deno.test("parseShiftCommand: エラー案内", () => {
  assertEquals(parseShiftCommand("シフト追加 10/3", TODAY)?.kind, "error");
  assertEquals(parseShiftCommand("シフト追加 14:30-22:00", TODAY)?.kind, "error");
  assertEquals(parseShiftCommand("シフト追加 10/3 22:00-14:00", TODAY)?.kind, "error");
  assertEquals(parseShiftCommand("シフト削除 10/3 14:30-22:00", TODAY)?.kind, "error");
  assertEquals(parseShiftCommand("シフト 10/3 14:30-22:00", TODAY)?.kind, "error");
});

const row = (username: string, date: string, start: string, end: string, br = 0): ShiftRow => ({
  id: `${username}-${date}`,
  staff_id: username,
  username,
  date,
  start,
  end,
  break_minutes: br,
});

Deno.test("formatShiftsForDate", () => {
  assertEquals(formatShiftsForDate("2026-09-29", []), "👷 2026-09-29 (火) のシフト\n登録なし");
  assertEquals(
    formatShiftsForDate("2026-09-29", [row("リド", "2026-09-29", "14:30", "22:00", 60)]),
    "👷 2026-09-29 (火) のシフト 1件\n・リド 14:30-22:00（休憩60分）",
  );
});

Deno.test("formatShiftsForRange: 空の日も出す", () => {
  const text = formatShiftsForRange("今週", "2026-09-28", "2026-09-30", [
    row("稲垣", "2026-09-28", "14:30", "22:00", 60),
    row("リド", "2026-09-29", "14:30", "22:00"),
  ]);
  assertEquals(
    text,
    [
      "👷 今週のシフト (9/28 (月)〜9/30 (水))",
      "",
      "9/28 (月)",
      "  ・稲垣 14:30-22:00（休憩60分）",
      "9/29 (火)",
      "  ・リド 14:30-22:00",
      "9/30 (水)",
      "  （なし）",
    ].join("\n"),
  );
});

Deno.test("formatDailyShiftBlock", () => {
  assertEquals(formatDailyShiftBlock([]), "👷 本日のシフト\n登録なし");
  assertEquals(
    formatDailyShiftBlock([row("リド", "2026-09-29", "14:30", "22:00", 60)]),
    "👷 本日のシフト\n・リド 14:30-22:00（休憩60分）",
  );
});
