// AI の窓口に来たリクエストの「誰か」を特定する。
//   - Claudeアプリ等: Supabase Auth の OAuth で発行されたアクセストークン(管理者・スタッフのアカウント)
//   - Claude Code・自動実行: 管理画面で発行した API キー(usk_...)
// どちらも profiles.role が admin / staff の人だけ通す。

import type { AgentCaller, Sql } from "./types.ts";

export const API_KEY_PREFIX = "usk_";

export type AuthResult =
  | { ok: true; caller: AgentCaller }
  | { ok: false; status: 401 | 403; error: string };

export const sha256Hex = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

/** JWT の中身を読むだけ(署名の確認は Supabase Auth に任せる)。操作ログに OAuth の client_id を残すために使う */
export const decodeJwtPayload = (jwt: string): Record<string, unknown> | null => {
  const part = jwt.split(".")[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
};

const UNAUTHORIZED: AuthResult = { ok: false, status: 401, error: "認証が必要です" };
const FORBIDDEN: AuthResult = { ok: false, status: 403, error: "このアカウントでは使えません（管理者・スタッフのアカウントでログインしてください）" };

export async function authenticateBearer(sql: Sql, authorization: string | null): Promise<AuthResult> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return UNAUTHORIZED;

  if (token.startsWith(API_KEY_PREFIX)) {
    const rows = await sql`
      update public.agent_api_keys k
      set last_used_at = now()
      from public.profiles p
      where k.key_hash = ${await sha256Hex(token)}
        and k.revoked_at is null
        and p.id = k.user_id
      returning k.user_id::text as user_id, k.name, p.role, p.username
    `;
    const row = rows[0];
    if (!row) return UNAUTHORIZED;
    if (row.role !== "admin" && row.role !== "staff") return FORBIDDEN;
    return {
      ok: true,
      caller: { userId: row.user_id, role: row.role, name: row.username ?? "", channel: "mcp", client: `apikey:${row.name}` },
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) throw new Error("Missing SUPABASE_URL / SUPABASE_ANON_KEY");

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return UNAUTHORIZED;
  const user = await res.json().catch(() => null);
  if (typeof user?.id !== "string") return UNAUTHORIZED;

  const rows = await sql`select role, username from public.profiles where id = ${user.id}::uuid`;
  const role = rows[0]?.role;
  if (role !== "admin" && role !== "staff") return FORBIDDEN;

  const clientId = decodeJwtPayload(token)?.client_id;
  return {
    ok: true,
    caller: {
      userId: user.id,
      role,
      name: rows[0].username ?? "",
      channel: "mcp",
      client: typeof clientId === "string" ? `oauth:${clientId}` : "session",
    },
  };
}
