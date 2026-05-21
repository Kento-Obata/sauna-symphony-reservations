import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
serve(async () => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const secretKeysJson = Deno.env.get('SUPABASE_SECRET_KEYS')!;
  const pubKeysJson = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const secretKeys = JSON.parse(secretKeysJson);
  const pubKeys = JSON.parse(pubKeysJson);

  const candidates: Record<string,string> = {
    SERVICE_ROLE_KEY: srk,
    SECRET_DEFAULT: secretKeys.default,
    ANON_KEY: anon,
    PUB_DEFAULT: pubKeys.default,
  };

  const results: any = {};
  for (const [name, key] of Object.entries(candidates)) {
    try {
      const r = await fetch(`${url}/rest/v1/reservations?select=date&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
      });
      results[name] = { status: r.status, prefix: key.slice(0,16), body: (await r.text()).slice(0,200) };
    } catch (e) { results[name] = { error: String(e) }; }
  }
  results._secretKeysShape = Object.keys(secretKeys);
  results._pubKeysShape = Object.keys(pubKeys);

  return new Response(JSON.stringify(results, null, 2), { headers: { 'Content-Type': 'application/json' } });
});
