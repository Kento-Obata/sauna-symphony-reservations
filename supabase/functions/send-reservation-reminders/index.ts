import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { format, addDays } from "https://esm.sh/date-fns@3.3.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const TIME_SLOTS = {
  morning: "10:00-12:30",
  afternoon: "13:30-16:00",
  evening: "17:00-19:30",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const formatPhoneNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return "+81" + digits.slice(1);
  }
  if (!digits.startsWith("0")) {
    return "+" + digits;
  }
  return digits;
};

const sendEmail = async (to: string, reservation: any) => {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Sauna Reservation <onboarding@resend.dev>",
        to: [to],
        subject: "【明日】サウナのご予約リマインダー",
        html: `
          <h1>ご予約リマインダー</h1>
          <p>${reservation.guest_name}様</p>
          <p>明日のサウナのご予約についてお知らせいたします：</p>
          <ul>
            <li>日時: ${reservation.date}</li>
            <li>時間: ${TIME_SLOTS[reservation.time_slot]}</li>
            <li>人数: ${reservation.guest_count}名</li>
            <li>水風呂温度: ${reservation.water_temperature}°C</li>
          </ul>
          <p>住所: 〒811-2127 福岡県糟屋郡宇美町障子岳6-8-4</p>
          <p>Plus Code: 8Q5GHG7V+J5</p>
          <p>Google Maps: https://maps.google.com/maps?q=8Q5GHG7V%2BJ5</p>
          <p>ご来店を心よりお待ちしております。</p>
        `,
      }),
    });

    if (!res.ok) {
      throw new Error(`メール送信に失敗しました: ${await res.text()}`);
    }
    console.log(`メールを送信しました: ${to}`);
  } catch (error) {
    console.error("メール送信エラー:", error);
  }
};

const sendSMS = async (phone: string, reservation: any) => {
  try {
    const formattedPhone = formatPhoneNumber(phone);
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const formData = new URLSearchParams();
    formData.append("To", formattedPhone);
    formData.append("From", TWILIO_PHONE_NUMBER);
    formData.append(
      "Body",
      `【明日のご予約リマインダー】\n${reservation.guest_name}様\n\n日時: ${
        reservation.date
      }\n時間: ${TIME_SLOTS[reservation.time_slot]}\n人数: ${
        reservation.guest_count
      }名\n水風呂温度: ${
        reservation.water_temperature
      }°C\n\n住所: 〒811-2127 福岡県糟屋郡宇美町障子岳6-8-4\nPlus Code: 8Q5GHG7V+J5\n\nご来店を心よりお待ちしております。`
    );

    const res = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`SMS送信に失敗しました: ${await res.text()}`);
    }
    console.log(`SMSを送信しました: ${phone}`);
  } catch (error) {
    console.error("SMS送信エラー:", error);
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log("予約リマインダー処理を開始します");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Supabaseクライアントの初期化
    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    );

    // 明日の日付を取得
    const tomorrow = addDays(new Date(), 1);
    const tomorrowStr = format(tomorrow, "yyyy-MM-dd");

    console.log(`明日の予約を確認します: ${tomorrowStr}`);

    // 明日の予約を取得
    const { data: reservations, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("date", tomorrowStr);

    if (error) {
      throw error;
    }

    console.log(`明日の予約数: ${reservations?.length || 0}`);

    // 各予約に対して通知を送信
    for (const reservation of reservations || []) {
      console.log(`予約を処理中: ${reservation.guest_name}`);

      // メールがある場合は送信
      if (reservation.email) {
        await sendEmail(reservation.email, reservation);
      }

      // SMSを送信
      await sendSMS(reservation.phone, reservation);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${reservations?.length || 0}件の予約通知を送信しました`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("予約リマインダー処理でエラーが発生しました:", error);
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