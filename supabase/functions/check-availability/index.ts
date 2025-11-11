import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Check availability function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const { date, timeSlot } = await req.json();

    if (!date || !timeSlot) {
      return new Response(
        JSON.stringify({ error: "日付と時間帯が必要です" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        }
      );
    }

    console.log("Checking availability for:", date, timeSlot);

    // Use service role key to bypass RLS
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check for existing confirmed reservations
    const { data: existingReservations, error } = await supabase
      .from("reservations")
      .select("id")
      .eq("date", date)
      .eq("time_slot", timeSlot)
      .eq("status", "confirmed");

    if (error) {
      console.error("Error checking reservations:", error);
      throw error;
    }

    const isAvailable = !existingReservations || existingReservations.length === 0;

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
      JSON.stringify({ error: error.message || "空き状況の確認に失敗しました" }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
};

serve(handler);
