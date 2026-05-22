import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const validTimeSlots = new Set(['morning', 'afternoon', 'evening', 'night']);

const getDb = () => {
  const databaseUrl = Deno.env.get('POSTGRES_URL');
  if (!databaseUrl) throw new Error('Missing POSTGRES_URL');
  return postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Check availability function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    const { date, timeSlot } = await req.json();

    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof timeSlot !== 'string' || !validTimeSlots.has(timeSlot)) {
      return new Response(
        JSON.stringify({ error: "日付と時間帯が必要です" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400
        }
      );
    }

    console.log("Checking availability for:", date, timeSlot);

    const rows = await sql`
      select id
      from public.reservations
      where date = ${date}::date
        and time_slot = ${timeSlot}::public.time_slot
        and status = 'confirmed'
      limit 1
    `;

    const isAvailable = rows.length === 0;
    console.log(`Availability check result: ${isAvailable ? 'available' : 'not available'}`);

    return new Response(
      JSON.stringify({ isAvailable }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "空き状況の確認に失敗しました" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
