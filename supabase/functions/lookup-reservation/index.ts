import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const { phone } = await req.json();
    console.log("Looking up reservations for phone:", phone);

    const { data: reservations, error } = await supabaseClient
      .from('reservations')
      .select('*')
      .eq('phone', phone)
      .order('date', { ascending: true });

    if (error) {
      throw error;
    }

    if (!reservations || reservations.length === 0) {
      return new Response(
        JSON.stringify({ error: "予約が見つかりませんでした" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    // Send SMS with reservation details
    const BASE_URL = "https://www.u-sauna-private.com";
    const formattedPhone = phone.startsWith('0') ? '+81' + phone.slice(1) : phone;
    
    const reservationLinks = reservations
      .map(r => `${r.date}: ${BASE_URL}/reservation/${r.reservation_code}`)
      .join('\n');

    const smsBody = `ご予約の詳細はこちらからご確認いただけます：\n\n${reservationLinks}`;

    const formData = new URLSearchParams();
    formData.append('To', formattedPhone);
    formData.append('From', TWILIO_PHONE_NUMBER);
    formData.append('Body', smsBody);

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        },
        body: formData,
      }
    );

    if (!twilioResponse.ok) {
      const twilioError = await twilioResponse.text();
      console.error("Twilio API error:", twilioError);
      throw new Error("SMS送信に失敗しました");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "予約詳細のリンクをSMSで送信しました",
        reservations: reservations,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in lookup-reservation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});