import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { getClientIp, isRateLimited, recordAttempt } from "./rate-limit.ts";

// A minimal mock of the postgres.js tagged-template `sql` function.
// `selectResult` is what each tagged query resolves to; `calls` captures
// the interpolated values so we can assert what was inserted.
function makeSqlMock(selectResult: unknown[]) {
  const calls: unknown[][] = [];
  const sql = (_strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push(values);
    return Promise.resolve(selectResult);
  };
  return { sql, calls };
}

Deno.test("getClientIp: x-forwarded-for の先頭を採用", () => {
  const req = new Request("https://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
  assertEquals(getClientIp(req), "1.2.3.4");
});

Deno.test("getClientIp: x-real-ip フォールバック", () => {
  const req = new Request("https://x", { headers: { "x-real-ip": "9.9.9.9" } });
  assertEquals(getClientIp(req), "9.9.9.9");
});

Deno.test("getClientIp: ヘッダ無しは unknown", () => {
  assertEquals(getClientIp(new Request("https://x")), "unknown");
});

Deno.test("isRateLimited: 上限未満なら false", async () => {
  const { sql } = makeSqlMock([{ c: 4 }]);
  const limited = await isRateLimited(sql, [
    { action: "lookup", identifier: "ABCD1234", max: 5, windowMinutes: 15 },
  ]);
  assertEquals(limited, false);
});

Deno.test("isRateLimited: 上限到達なら true", async () => {
  const { sql } = makeSqlMock([{ c: 5 }]);
  const limited = await isRateLimited(sql, [
    { action: "lookup", identifier: "ABCD1234", max: 5, windowMinutes: 15 },
  ]);
  assertEquals(limited, true);
});

Deno.test("isRateLimited: 複数ルールのいずれかが超過で true", async () => {
  const { sql } = makeSqlMock([{ c: 99 }]);
  const limited = await isRateLimited(sql, [
    { action: "lookup", identifier: "code", max: 5, windowMinutes: 15 },
    { action: "lookup", identifier: "ip", max: 20, windowMinutes: 15 },
  ]);
  assertEquals(limited, true);
});

Deno.test("recordAttempt: 識別子ごとに1行ずつ挿入", async () => {
  const { sql, calls } = makeSqlMock([]);
  await recordAttempt(sql, "cancel", ["ABCD1234", "1.2.3.4"], false);
  assertEquals(calls.length, 2);
  assertEquals(calls[0], ["cancel", "ABCD1234", false]);
  assertEquals(calls[1], ["cancel", "1.2.3.4", false]);
});
