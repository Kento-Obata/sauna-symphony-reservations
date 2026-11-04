// Supabase Auth の OAuth 2.1 サーバーの中継。
// 本番の API ゲートウェイは、OAuth の入口(メタデータ・authorize・token・クライアント登録)でも apikey の無い
// リクエストを拒む。apikey を知らない MCP クライアント(Claude アプリ等)には agent-mcp を認可サーバーとして見せ、
// Supabase Auth へは公開キーを付けて渡す。ログイン・同意(/oauth/consent)・トークンの発行は Supabase Auth がそのまま行う。

export interface OAuthProxyConfig {
  /** agent-mcp の URL(MCP サーバー兼、クライアントから見た認可サーバー) */
  resourceUrl: string;
  /** Supabase Auth の URL(https://<ref>.supabase.co/auth/v1) */
  authUrl: string;
  /** Supabase Auth の認可サーバーのメタデータ */
  upstreamMetadataUrl: string;
  anonKey: string;
}

// RFC 8707 の resource: Supabase Auth はトークンの宛先を絞らないので渡さない
const DROPPED_PARAMS = ["resource"];

// OpenID Connect の ID トークンは発行元(iss)が Supabase Auth になり、中継している認可サーバーと食い違うため使わせない
const OIDC_ONLY_FIELDS = ["userinfo_endpoint", "claims_supported", "id_token_signing_alg_values_supported", "subject_types_supported"];

export const rewriteMetadata = (upstream: Record<string, unknown>, resourceUrl: string): Record<string, unknown> => {
  const metadata: Record<string, unknown> = { ...upstream };
  for (const field of OIDC_ONLY_FIELDS) delete metadata[field];
  const scopes = Array.isArray(upstream.scopes_supported) ? upstream.scopes_supported : [];
  return {
    ...metadata,
    issuer: resourceUrl,
    authorization_endpoint: `${resourceUrl}/oauth/authorize`,
    token_endpoint: `${resourceUrl}/oauth/token`,
    registration_endpoint: `${resourceUrl}/oauth/register`,
    scopes_supported: scopes.filter((s) => s !== "openid"),
  };
};

export const authorizeRedirect = (requestUrl: URL, cfg: OAuthProxyConfig): string => {
  const params = new URLSearchParams(requestUrl.search);
  for (const p of DROPPED_PARAMS) params.delete(p);
  params.set("apikey", cfg.anonKey);
  return `${cfg.authUrl}/oauth/authorize?${params.toString()}`;
};

export const stripDroppedParams = (body: string, contentType: string): string => {
  if (!contentType.includes("application/x-www-form-urlencoded")) return body;
  const params = new URLSearchParams(body);
  for (const p of DROPPED_PARAMS) params.delete(p);
  return params.toString();
};

/** OAuth の中継に当たるリクエストなら応答を返す。当たらなければ null */
export async function handleOAuthProxy(
  req: Request,
  path: string,
  cfg: OAuthProxyConfig,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (path.endsWith("/.well-known/oauth-authorization-server") || path.endsWith("/.well-known/openid-configuration")) {
    const res = await fetch(cfg.upstreamMetadataUrl, { headers: { apikey: cfg.anonKey } });
    if (!res.ok) {
      return new Response(await res.text(), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify(rewriteMetadata(await res.json(), cfg.resourceUrl)), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  }

  if (path.endsWith("/oauth/authorize") && req.method === "GET") {
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: authorizeRedirect(new URL(req.url), cfg), "Cache-Control": "no-store" },
    });
  }

  const upstreamPath = path.endsWith("/oauth/token") ? "/oauth/token" : path.endsWith("/oauth/register") ? "/oauth/clients/register" : null;
  if (upstreamPath && req.method === "POST") {
    const contentType = req.headers.get("content-type") ?? "application/json";
    const body = stripDroppedParams(await req.text(), contentType);
    const headers: Record<string, string> = { apikey: cfg.anonKey, "Content-Type": contentType };
    // client_secret_basic のクライアント認証はそのまま渡す
    const authorization = req.headers.get("authorization");
    if (authorization?.startsWith("Basic ")) headers.Authorization = authorization;
    const res = await fetch(`${cfg.authUrl}${upstreamPath}`, { method: "POST", headers, body });
    return new Response(await res.text(), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": res.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" },
    });
  }

  return null;
}
