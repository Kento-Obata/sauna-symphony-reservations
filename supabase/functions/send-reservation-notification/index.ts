import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Twilio } from "https://esm.sh/twilio@4.19.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { date, timeSlot, guestName, guestCount, email, phone, waterTemperature, reservationCode, confirmationToken } = await req.json();

    const notifications = [];
    const GOOGLE_MAPS_URL = "https://maps.google.com/maps?q=8Q5GHG7V%2BJ5";
    const BASE_URL = "https://u-sauna-private.com";  // カスタムドメインに更新
    const CONFIRMATION_URL = `${BASE_URL}/reservation/confirm/${confirmationToken}`;

    console.log("Starting notification process for:", { guestName, phone, email });
    console.log("Confirmation URL:", CONFIRMATION_URL);

    if (email) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          },
          body: JSON.stringify({
            from: "U <noreply@u-sauna-private.com>",
            to: email,
            subject: "【U】ご予約の確認",
            html: `
              <p>${guestName} 様</p>
              <p>Uのご予約ありがとうございます。<br>以下のリンクから予約を確定してください。</p>
              <p><a href="${CONFIRMATION_URL}">予約を確定する</a></p>
              <p>※このリンクの有効期限は20分です。</p>
              <hr>
              <h3>ご予約内容</h3>
              <p>
                日時: ${date} ${
                  timeSlot === "morning"
                    ? "10:00-13:00"
                    : timeSlot === "afternoon"
                    ? "14:00-17:00"
                    : "18:00-21:00"
                }<br>
                人数: ${guestCount}名<br>
                水風呂温度: ${waterTemperature}℃
              </p>
              <p>
                場所: <a href="${GOOGLE_MAPS_URL}">Googleマップで見る</a>
              </p>
              <hr>
              <p>ご不明な点がございましたら、このメールにご返信ください。</p>
            `,
          }),
        });
        
        if (!emailResponse.ok) {
          throw new Error(`Email API responded with status: ${emailResponse.status}`);
        }
        
        notifications.push(await emailResponse.json());
        console.log("Email sent successfully");
      } catch (error) {
        console.error("Failed to send email:", error);
        throw new Error(`Email sending failed: ${error.message}`);
      }
    }

    if (phone) {
      try {
        console.log("Initializing Twilio client");
        const twilioClient = new Twilio(
          Deno.env.get("TWILIO_ACCOUNT_SID"),
          Deno.env.get("TWILIO_AUTH_TOKEN")
        );

        // Format phone number
        let formattedPhone = phone.replace(/[^\d]/g, ''); // Remove non-digit characters
        if (formattedPhone.startsWith('0')) {
          formattedPhone = '+81' + formattedPhone.slice(1);
        } else if (!formattedPhone.startsWith('+')) {
          formattedPhone = '+' + formattedPhone;
        }
        
        console.log("Formatted phone number:", formattedPhone);

        const message = await twilioClient.messages.create({
          body: `【U】ご予約ありがとうございます。以下のリンクから予約を確定してください（有効期限20分）\n${CONFIRMATION_URL}`,
          from: Deno.env.get("TWILIO_PHONE_NUMBER"),
          to: formattedPhone,
        });
        
        console.log("SMS sent successfully. Message SID:", message.sid);
        notifications.push(message);
      } catch (error) {
        console.error("Failed to send SMS:", error);
        console.error("Twilio error details:", {
          sid: error.sid,
          status: error.status,
          code: error.code,
          message: error.message
        });
        throw new Error(`SMS sending failed: ${error.message}`);
      }
    }

    return new Response(JSON.stringify({ notifications }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in send-reservation-notification:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});