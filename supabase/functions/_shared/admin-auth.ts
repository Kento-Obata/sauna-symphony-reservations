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
