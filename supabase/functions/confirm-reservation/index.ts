import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Starting reservation confirmation process");
    const { token } = await req.json();
    
    if (!token) {
      console.error("No token provided");
      throw new Error("確認トークンが提供されていません。");
    }

    console.log("Received token:", token);

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Looking for reservation with token:", token);

    // Find the reservation
    const { data: reservation, error: findError } = await supabaseClient
      .from("reservations")
      .select("*")
      .eq("confirmation_token", token)
      .eq("status", "pending")  // 仮予約状態のみを対象とする
      .single();

    console.log("Database query result:", {
      reservation: reservation,
      error: findError
    });

    if (findError) {
      console.error("Database error when finding reservation:", findError);
      throw new Error("予約の検索中にエラーが発生しました。");
    }

    if (!reservation) {
      console.error("No reservation found with token:", token);
      throw new Error("予約が見つかりません。期限切れまたは無効なトークンです。");
    }

    if (reservation.is_confirmed) {
      console.log("Reservation already confirmed:", reservation.reservation_code);
      return new Response(
        JSON.stringify({
          success: true,
          message: "この予約は既に確定済みです。",
          reservation_code: reservation.reservation_code,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log("Updating reservation status:", reservation.id);

    // Update the reservation status
    const { error: updateError } = await supabaseClient
      .from("reservations")
      .update({
        status: "confirmed",
        is_confirmed: true,
      })
      .eq("id", reservation.id)
      .eq("confirmation_token", token);

    console.log("Update result:", {
      error: updateError
    });

    if (updateError) {
      console.error("Error updating reservation:", updateError);
      throw new Error("予約の更新中にエラーが発生しました。");
    }

    console.log("Reservation confirmed successfully:", reservation.reservation_code);

    return new Response(
      JSON.stringify({
        success: true,
        message: "予約が確定されました。",
        reservation_code: reservation.reservation_code,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in confirm-reservation:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "予約の確定中にエラーが発生しました。",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});