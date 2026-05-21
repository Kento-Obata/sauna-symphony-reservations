import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
serve(async () => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const results: any = {};
  
  // Test 1: direct curl with srk as apikey
  try {
    const r = await fetch(`${url}/rest/v1/reservations?select=date&limit=1`, {
      headers: { apikey: srk, Authorization: `Bearer ${srk}` }
    });
    results.direct = { status: r.status, body: await r.text() };
  } catch (e) { results.direct = { error: String(e) }; }
  
  // Test 2: supabase-js client
  try {
    const sb = createClient(url, srk);
    const { data, error } = await sb.from('reservations').select('date').limit(1);
    results.client = { data, error };
  } catch (e) { results.client = { error: String(e) }; }
  
  return new Response(JSON.stringify(results, null, 2), { headers: { 'Content-Type': 'application/json' } });
});
