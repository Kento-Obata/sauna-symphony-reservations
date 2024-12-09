import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  console.log("予約確認機能が呼び出されました");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    console.log("確認トークン:", token);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find the reservation by confirmation token
    const { data: reservation, error: findError } = await supabase
      .from("reservations")
      .select("*")
      .eq("confirmation_token", token)
      .eq("status", "pending")  // 仮予約状態のみを対象とする
      .single();

    if (findError || !reservation) {
      console.error("予約が見つかりません:", findError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid or expired confirmation token",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    // Check if the reservation has expired
    if (new Date(reservation.expires_at) < new Date()) {
      console.error("予約の有効期限が切れています");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Reservation has expired",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Update the reservation to confirmed status
    const { error: updateError } = await supabase
      .from("reservations")
      .update({
        status: "confirmed",  // ステータスを本予約に更新
        is_confirmed: true,
        confirmation_token: null,
        expires_at: null,
      })
      .eq("id", reservation.id);

    if (updateError) {
      console.error("予約の更新に失敗しました:", updateError);
      throw updateError;
    }

    console.log("予約を確定しました:", reservation.id);

    return new Response(
      JSON.stringify({
        success: true,
        reservation_code: reservation.reservation_code,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("予約確認でエラーが発生しました:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
};

serve(handler);