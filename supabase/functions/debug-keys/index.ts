import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

serve(async () => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!);
  const pubKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')!);

  const candidates: Record<string,string> = {
    SECRET_u_sauna: secretKeys.u_sauna,
    PUB_u_sauna: pubKeys.u_sauna,
  };

  const results: any = {};
  for (const [name, key] of Object.entries(candidates)) {
    const r = await fetch(`${url}/rest/v1/reservations?select=date&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    results[name] = { status: r.status, prefix: key.slice(0,16), body: (await r.text()).slice(0,150) };
  }
  const dbUrl = Deno.env.get('SUPABASE_DB_URL');
  results.DB_URL = { exists: !!dbUrl };
  if (dbUrl) {
    const sql = postgres(dbUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
    try {
      const rows = await sql`select count(*)::int as count from public.reservations`;
      results.DB_URL.count = rows[0]?.count ?? null;
      results.DB_URL.ok = true;
    } catch (error) {
      results.DB_URL.ok = false;
      results.DB_URL.error = error instanceof Error ? error.message : String(error);
    } finally {
      await sql.end({ timeout: 1 });
    }
  }
  return new Response(JSON.stringify(results, null, 2), { headers: { 'Content-Type': 'application/json' } });
});
