import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
serve(() => {
  const keys = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEYS','SUPABASE_PUBLISHABLE_KEY','SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY','SUPABASE_JWKS'];
  const out: any = {};
  for (const k of keys) {
    const v = Deno.env.get(k) || '';
    out[k] = { present: !!v, len: v.length, prefix: v.slice(0, 14) };
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
});
