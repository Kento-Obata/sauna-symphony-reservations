import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { authenticateBearer } from "../_shared/agent/auth.ts";
import { createAgentContext } from "../_shared/agent/context.ts";
import { handleMcpPayload, RPC_PARSE_ERROR, rpcError } from "../_shared/agent/mcp.ts";
import { ToolRegistry } from "../_shared/agent/registry.ts";
import { agentTools } from "../_shared/agent/tools/index.ts";

// AIエージェント(Claudeアプリ・Claude Code 等)から店舗管理を操作する MCP サーバー。
// セッションを持たない Streamable HTTP(JSON 応答)。認証は OAuth のアクセストークンか API キー。
// 未認証には 401 と保護リソースのメタデータ(RFC 9728)の場所を返し、クライアントは
// そこから Supabase Auth の OAuth 2.1 サーバーを見つけてログインする。

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
};

const registry = new ToolRegistry(agentTools);

const supabaseUrl = () => {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("Missing SUPABASE_URL");
  return url;
};
const resourceUrl = () => `${supabaseUrl()}/functions/v1/agent-mcp`;
const metadataUrl = () => `${resourceUrl()}/.well-known/oauth-protected-resource`;

const getDb = () => {
  const databaseUrl = Deno.env.get("POSTGRES_URL") ?? Deno.env.get("SUPABASE_DB_URL");
  if (!databaseUrl) throw new Error("Missing POSTGRES_URL / SUPABASE_DB_URL");
  return postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const path = new URL(req.url).pathname;
  if (path.endsWith("/.well-known/oauth-protected-resource")) {
    return json({
      resource: resourceUrl(),
      authorization_servers: [`${supabaseUrl()}/auth/v1`],
      bearer_methods_supported: ["header"],
      resource_name: "U sauna 店舗管理",
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { ...corsHeaders, Allow: "POST, OPTIONS" } });
  }

  const sql = getDb();
  try {
    const auth = await authenticateBearer(sql, req.headers.get("Authorization"));
    if (!auth.ok) {
      const challenge = auth.status === 401
        ? `Bearer resource_metadata="${metadataUrl()}"${req.headers.has("Authorization") ? ', error="invalid_token"' : ""}`
        : `Bearer error="insufficient_scope", resource_metadata="${metadataUrl()}"`;
      return json({ error: auth.error }, auth.status, { "WWW-Authenticate": challenge });
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return json(rpcError(null, RPC_PARSE_ERROR, "Parse error"), 400);
    }

    const ctx = createAgentContext(sql, auth.caller);
    const response = await handleMcpPayload(payload, ctx, registry);
    return response === null ? new Response(null, { status: 202, headers: corsHeaders }) : json(response);
  } catch (error) {
    console.error("agent-mcp error:", error);
    return json(rpcError(null, -32603, "Internal error"), 500);
  } finally {
    await sql.end({ timeout: 1 });
  }
};

Deno.serve(handler);
