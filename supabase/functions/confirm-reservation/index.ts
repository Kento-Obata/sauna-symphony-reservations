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
  console.log("予約確認機能が呼び出されました - リクエストメソッド:", req.method);
  console.log("リクエストURL:", req.url);
  console.log("リクエストヘッダー:", Object.fromEntries(req.headers.entries()));

  if (req.method === "OPTIONS") {
    console.log("OPTIONSリクエストを処理します");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.text();
    console.log("リクエストボディ (raw):", requestBody);

    let token;
    try {
      const jsonBody = JSON.parse(requestBody);
      token = jsonBody.token;
      console.log("パースされたトークン:", token);
    } catch (parseError) {
      console.error("JSONパースエラー:", parseError);
      throw new Error("Invalid JSON in request body");
    }

    if (!token) {
      console.error("トークンが提供されていません");
      throw new Error("No token provided");
    }

    console.log("Supabaseクライアントを初期化します");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("予約を検索中...");
    const { data: reservation, error: findError } = await supabase
      .from("reservations")
      .select("*")
      .eq("confirmation_token", token)
      .eq("status", "pending")
      .single();

    if (findError) {
      console.error("予約検索エラー:", findError);
      throw findError;
    }

    if (!reservation) {
      console.error("予約が見つかりません。トークン:", token);
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

    console.log("予約が見つかりました:", reservation);

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

    console.log("予約を確定状態に更新します");
    const { error: updateError } = await supabase
      .from("reservations")
      .update({
        status: "confirmed",
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