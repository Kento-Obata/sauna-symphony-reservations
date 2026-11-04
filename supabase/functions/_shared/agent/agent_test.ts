import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { validateInput } from "./validate.ts";
import { type AgentStore, CONFIRM_TOOL, ToolRegistry } from "./registry.ts";
import { handleMcpPayload, SUPPORTED_PROTOCOL_VERSIONS } from "./mcp.ts";
import { decodeJwtPayload } from "./auth.ts";
import { authorizeRedirect, rewriteMetadata, stripDroppedParams } from "./oauth-proxy.ts";
import { type AgentContext, type AgentRole, type AgentTool, ToolError } from "./types.ts";

// --- テスト用の道具と保存先 ---

const memoryStore = () => {
  const pending = new Map<string, { userId: string; tool: string; input: Record<string, unknown>; used: boolean }>();
  const logs: { tool: string; status: string }[] = [];
  const store: AgentStore = {
    createPending: (ctx, tool, input) => {
      const id = crypto.randomUUID();
      pending.set(id, { userId: ctx.caller.userId, tool, input, used: false });
      return Promise.resolve(id);
    },
    takePending: (ctx, id) => {
      const p = pending.get(id);
      if (!p || p.used || p.userId !== ctx.caller.userId) return Promise.resolve(null);
      p.used = true;
      return Promise.resolve({ tool: p.tool, input: p.input });
    },
    log: (_ctx, entry) => {
      logs.push({ tool: entry.tool, status: entry.status });
      return Promise.resolve();
    },
  };
  return { store, logs };
};

const ctxFor = (role: AgentRole, userId = "u1"): AgentContext => ({
  caller: { userId, role, name: "テスト", channel: "mcp", client: "test" },
  sql: null,
  asUser: () => Promise.reject(new Error("not used")),
  todayYmd: "2026-11-04",
});

const refunds: string[] = [];

const tools: AgentTool[] = [
  {
    name: "list_things",
    title: "一覧",
    description: "見るだけ",
    inputSchema: {
      type: "object",
      properties: { date: { type: "string", format: "date" }, limit: { type: "integer", minimum: 1, maximum: 50, default: 10 } },
      required: ["date"],
      additionalProperties: false,
    },
    roles: ["admin", "staff"],
    kind: "read",
    run: (_ctx, input) => Promise.resolve({ text: `${input.date} の一覧`, data: { limit: input.limit } }),
  },
  {
    name: "refund",
    title: "返金",
    description: "危険",
    inputSchema: {
      type: "object",
      properties: { code: { type: "string", pattern: "^[A-Z0-9]{8}$" } },
      required: ["code"],
    },
    roles: ["admin"],
    kind: "dangerous",
    preview: (_ctx, input) => Promise.resolve(`予約 ${input.code} を返金します`),
    run: (_ctx, input) => {
      if (input.code === "NOTFOUND") throw new ToolError("見つかりません");
      refunds.push(input.code as string);
      return Promise.resolve({ text: `${input.code} を返金しました` });
    },
  },
];

// --- validate ---

Deno.test("validate: 既定値を補い、数値の文字列と null の任意項目を受け入れる", () => {
  const r = validateInput(tools[0].inputSchema, { date: "2026-11-04", limit: "5" });
  assertEquals(r, { ok: true, value: { date: "2026-11-04", limit: 5 } });
  const d = validateInput(tools[0].inputSchema, { date: "2026-11-04", limit: null });
  assertEquals(d, { ok: true, value: { date: "2026-11-04", limit: 10 } });
});

Deno.test("validate: 誤りを日本語で返す(存在しない日付・範囲外・必須・余分な項目)", () => {
  const r = validateInput(tools[0].inputSchema, { date: "2026-02-30", limit: 100, extra: 1 });
  assert(!r.ok);
  if (!r.ok) {
    assertEquals(r.errors.length, 3);
    assertStringIncludes(r.errors.join("\n"), "YYYY-MM-DD");
    assertStringIncludes(r.errors.join("\n"), "50以下");
    assertStringIncludes(r.errors.join("\n"), "extra: 使えない項目です");
  }
  const missing = validateInput(tools[0].inputSchema, {});
  assert(!missing.ok && missing.errors[0] === "date: 必須です");
});

Deno.test("validate: enum・入れ子・配列", () => {
  const schema = {
    type: "object" as const,
    properties: {
      slot: { type: "string" as const, enum: ["morning", "afternoon"] },
      tiers: {
        type: "array" as const,
        maxItems: 2,
        items: { type: "object" as const, properties: { tier: { type: "integer" as const, enum: [1, 2] } }, required: ["tier"] },
      },
    },
  };
  assert(validateInput(schema, { slot: "morning", tiers: [{ tier: 1 }] }).ok);
  const bad = validateInput(schema, { slot: "noon", tiers: [{ tier: 3 }, {}, {}] });
  assert(!bad.ok && bad.errors.length === 5, JSON.stringify(bad));
});

// --- registry ---

Deno.test("registry: 役割で道具を絞る。確認の要る道具が無ければ confirm_action も出さない", () => {
  const { store } = memoryStore();
  const registry = new ToolRegistry(tools, store);
  assertEquals(registry.list("admin").map((t) => t.name), ["list_things", "refund", CONFIRM_TOOL]);
  assertEquals(registry.list("staff").map((t) => t.name), ["list_things"]);
  assert(!registry.has("refund", "staff"));
});

Deno.test("registry: 危険な操作は確認待ちになり、confirm_action で控えた入力どおりに一度だけ実行される", async () => {
  const { store, logs } = memoryStore();
  const registry = new ToolRegistry(tools, store);
  refunds.length = 0;

  const first = await registry.call(ctxFor("admin"), "refund", { code: "ABCD1234" });
  assertEquals(first.status, "pending_confirmation");
  assertEquals(refunds, []);
  assertStringIncludes(first.output.text, "予約 ABCD1234 を返金します");
  const id = (first.output.data as { confirmation_id: string }).confirmation_id;

  // 別の人は実行できない
  const other = await registry.call(ctxFor("admin", "u2"), CONFIRM_TOOL, { confirmation_id: id });
  assert(other.isError);
  assertEquals(refunds, []);

  const done = await registry.call(ctxFor("admin"), CONFIRM_TOOL, { confirmation_id: id });
  assertEquals(done.status, "ok");
  assertEquals(refunds, ["ABCD1234"]);

  const again = await registry.call(ctxFor("admin"), CONFIRM_TOOL, { confirmation_id: id });
  assert(again.isError);
  assertStringIncludes(again.output.text, "すでに実行済み");
  assertEquals(refunds, ["ABCD1234"]);
  assert(logs.some((l) => l.tool === "refund" && l.status === "confirmed"));
});

Deno.test("registry: 権限外・入力の誤り・ToolError・想定外の例外", async () => {
  const { store } = memoryStore();
  const registry = new ToolRegistry([
    ...tools,
    {
      name: "boom",
      title: "失敗",
      description: "",
      inputSchema: { type: "object", properties: {} },
      roles: ["admin"],
      kind: "read",
      run: () => Promise.reject(new Error("db down")),
    },
  ], store);

  const forbidden = await registry.call(ctxFor("staff"), "refund", { code: "ABCD1234" });
  assert(forbidden.isError);

  const invalid = await registry.call(ctxFor("admin"), "list_things", { date: "11/4" });
  assert(invalid.isError);
  assertStringIncludes(invalid.output.text, "入力が正しくありません");

  const pending = await registry.call(ctxFor("admin"), "refund", { code: "NOTFOUND" });
  const id = (pending.output.data as { confirmation_id: string }).confirmation_id;
  const notFound = await registry.call(ctxFor("admin"), CONFIRM_TOOL, { confirmation_id: id });
  assert(notFound.isError);
  assertEquals(notFound.output.text, "見つかりません");

  const unexpected = await registry.call(ctxFor("admin"), "boom", {});
  assert(unexpected.isError);
  assertStringIncludes(unexpected.output.text, "内部エラー");
});

// --- MCP ---

Deno.test("mcp: initialize は対応する版を返し、未知の版には最新版を返す", async () => {
  const registry = new ToolRegistry(tools, memoryStore().store);
  const ok = await handleMcpPayload(
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {} } },
    ctxFor("admin"),
    registry,
  ) as { result: { protocolVersion: string; capabilities: unknown } };
  assertEquals(ok.result.protocolVersion, "2025-06-18");
  assertEquals(ok.result.capabilities, { tools: { listChanged: false } });

  const future = await handleMcpPayload(
    { jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "2099-01-01" } },
    ctxFor("admin"),
    registry,
  ) as { result: { protocolVersion: string } };
  assertEquals(future.result.protocolVersion, SUPPORTED_PROTOCOL_VERSIONS[0]);
});

Deno.test("mcp: 通知には返事をせず、tools/list は役割で絞り、tools/call は結果を text で返す", async () => {
  const registry = new ToolRegistry(tools, memoryStore().store);
  assertEquals(await handleMcpPayload({ jsonrpc: "2.0", method: "notifications/initialized" }, ctxFor("staff"), registry), null);

  const list = await handleMcpPayload({ jsonrpc: "2.0", id: 3, method: "tools/list" }, ctxFor("staff"), registry) as {
    result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] };
  };
  assertEquals(list.result.tools.map((t) => t.name), ["list_things"]);
  assert(list.result.tools[0].annotations.readOnlyHint);

  const call = await handleMcpPayload(
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "list_things", arguments: { date: "2026-11-04" } } },
    ctxFor("staff"),
    registry,
  ) as { result: { content: { text: string }[]; isError: boolean } };
  assert(!call.result.isError);
  assertStringIncludes(call.result.content[0].text, "2026-11-04 の一覧");
  assertStringIncludes(call.result.content[0].text, '"limit": 10');

  const hidden = await handleMcpPayload(
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "refund", arguments: { code: "ABCD1234" } } },
    ctxFor("staff"),
    registry,
  ) as { error: { code: number } };
  assertEquals(hidden.error.code, -32602);

  const unknown = await handleMcpPayload({ jsonrpc: "2.0", id: 6, method: "resources/list" }, ctxFor("admin"), registry) as {
    error: { code: number };
  };
  assertEquals(unknown.error.code, -32601);
});

Deno.test("mcp: バッチは応答のあるものだけ返す", async () => {
  const registry = new ToolRegistry(tools, memoryStore().store);
  const res = await handleMcpPayload(
    [{ jsonrpc: "2.0", method: "notifications/initialized" }, { jsonrpc: "2.0", id: 7, method: "ping" }],
    ctxFor("admin"),
    registry,
  ) as unknown[];
  assertEquals(res, [{ jsonrpc: "2.0", id: 7, result: {} }]);
});

Deno.test("auth: JWT の中身(client_id)を読める", () => {
  const payload = btoa(JSON.stringify({ sub: "abc", client_id: "cli_1" })).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  assertEquals(decodeJwtPayload(`h.${payload}.s`)?.client_id, "cli_1");
  assertEquals(decodeJwtPayload("garbage"), null);
});

// --- OAuth の中継 ---


const proxyCfg = {
  resourceUrl: "https://x.supabase.co/functions/v1/agent-mcp",
  authUrl: "https://x.supabase.co/auth/v1",
  upstreamMetadataUrl: "https://x.supabase.co/.well-known/oauth-authorization-server/auth/v1",
  anonKey: "anon-key",
};

Deno.test("oauth-proxy: メタデータの入口を中継先に差し替え、OpenID Connect の項目と openid を外す", () => {
  const out = rewriteMetadata({
    issuer: "https://x.supabase.co/auth/v1",
    authorization_endpoint: "https://x.supabase.co/auth/v1/oauth/authorize",
    token_endpoint: "https://x.supabase.co/auth/v1/oauth/token",
    registration_endpoint: "https://x.supabase.co/auth/v1/oauth/clients/register",
    userinfo_endpoint: "https://x.supabase.co/auth/v1/oauth/userinfo",
    id_token_signing_alg_values_supported: ["ES256"],
    scopes_supported: ["openid", "email", "offline_access"],
    code_challenge_methods_supported: ["S256"],
  }, proxyCfg.resourceUrl);
  assertEquals(out.issuer, proxyCfg.resourceUrl);
  assertEquals(out.authorization_endpoint, `${proxyCfg.resourceUrl}/oauth/authorize`);
  assertEquals(out.token_endpoint, `${proxyCfg.resourceUrl}/oauth/token`);
  assertEquals(out.registration_endpoint, `${proxyCfg.resourceUrl}/oauth/register`);
  assertEquals(out.scopes_supported, ["email", "offline_access"]);
  assertEquals(out.code_challenge_methods_supported, ["S256"]);
  assert(!("userinfo_endpoint" in out) && !("id_token_signing_alg_values_supported" in out));
});

Deno.test("oauth-proxy: authorize は resource を外し公開キーを付けて Supabase Auth へ転送する", () => {
  const url = new URL(`${proxyCfg.resourceUrl}/oauth/authorize?client_id=c1&response_type=code&code_challenge=abc&resource=${encodeURIComponent(proxyCfg.resourceUrl)}&state=s`);
  const location = new URL(authorizeRedirect(url, proxyCfg));
  assertEquals(location.origin + location.pathname, "https://x.supabase.co/auth/v1/oauth/authorize");
  assertEquals(location.searchParams.get("client_id"), "c1");
  assertEquals(location.searchParams.get("state"), "s");
  assertEquals(location.searchParams.get("apikey"), "anon-key");
  assertEquals(location.searchParams.has("resource"), false);
});

Deno.test("oauth-proxy: token のフォームから resource を外す(JSON はそのまま)", () => {
  assertEquals(
    stripDroppedParams("grant_type=authorization_code&code=x&resource=https%3A%2F%2Fa", "application/x-www-form-urlencoded"),
    "grant_type=authorization_code&code=x",
  );
  assertEquals(stripDroppedParams('{"a":1}', "application/json"), '{"a":1}');
});
