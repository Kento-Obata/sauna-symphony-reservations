// 管理者認可の共通ヘルパー。
//
// config.toml の verify_jwt=true は「プロジェクトの JWT であること」しか保証せず、
// anon key の JWT でも通ってしまう。管理者専用関数は必ずこのヘルパーで
// auth.getUser(jwt) + profiles.role='admin' をサーバ側で検証すること。

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

// deno-lint-ignore-file
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = any; // postgresjs の接続(型パッケージ非導入のため)

export type AdminAuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

export const requireAdmin = async (req: Request, sql: Sql): Promise<AdminAuthResult> => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!jwt || !supabaseUrl || !serviceKey) {
    return { ok: false, status: 401, error: "認証情報がありません" };
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return { ok: false, status: 401, error: "認証に失敗しました" };
  }

  const roleRows = await sql`
    select role from public.profiles where id = ${userData.user.id}::uuid limit 1
  `;
  if (roleRows[0]?.role !== 'admin') {
    return { ok: false, status: 403, error: "管理者権限がありません" };
  }

  return { ok: true, userId: userData.user.id };
};

/**
 * 管理者ユーザー、または service role キー(運用スクリプトからの呼び出し)だけを通す。
 * DB 接続(postgresjs)を持たない関数向けに、ロールの確認も supabase-js で行う。
 */
export const requireAdminOrServiceRole = async (req: Request): Promise<AdminAuthResult> => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!jwt || !supabaseUrl || !serviceKey) {
    return { ok: false, status: 401, error: "認証情報がありません" };
  }
  if (jwt === serviceKey) return { ok: true, userId: "service_role" };

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData?.user) {
    // ユーザーのトークンでなければ、service role キーかどうかを管理 API が通るかで確かめる
    // (環境変数のキーと形式が違う場合がある: 従来の JWT / sb_secret_)
    const asService = createClient(supabaseUrl, jwt, { auth: { persistSession: false } });
    const { error: serviceError } = await asService.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (!serviceError) return { ok: true, userId: "service_role" };
    return { ok: false, status: 401, error: "認証に失敗しました" };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { ok: false, status: 403, error: "管理者権限がありません" };
  }
  return { ok: true, userId: userData.user.id };
};
