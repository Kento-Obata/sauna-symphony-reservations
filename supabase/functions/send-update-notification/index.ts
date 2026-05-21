
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendSMS } from "../_shared/twilio.ts";
import { sendEmail } from "../_shared/email.ts";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reservationCode, ...updateData } = await req.json();

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Fetch reservation details to check status
    const { data: reservation, error: fetchError } = await supabaseClient
      .from("reservations")
      .select("*")
      .eq("reservation_code", reservationCode)
      .single();

    if (fetchError || !reservation) {
      throw new Error("予約が見つかりませんでした");
    }

    // キャンセル通知の場合は専用のメッセージを送信
    const isCancel = reservation.status === "cancelled";
    const subject = isCancel ? "予約キャンセルのお知らせ" : "予約更新のお知らせ";
    const message = isCancel 
      ? `ご予約(予約コード: ${reservationCode})のキャンセルを承りました。またのご利用をお待ちしております。` 
      : `ご予約(予約コード: ${reservationCode})が更新されました。詳細は予約確認ページをご確認ください。`;

    // Send SMS notification
    if (reservation.phone) {
      await sendSMS(reservation.phone, message);
    }

    // Send email notification
    if (reservation.email) {
      await sendEmail(reservation.email, subject, message);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
};

serve(handler);
