import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReservationNotification {
  date: string;
  timeSlot: string;
  guestName: string;
  guestCount: number;
  email: string | null;
  phone: string;
  waterTemperature: number;
  reservationCode: string;
  confirmationToken: string;
}

const TIME_SLOTS = {
  morning: "10:00-12:30",
  afternoon: "13:30-16:00",
  evening: "17:00-19:30",
};

const formatPhoneNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? '+81' + digits.slice(1) : digits;
};

const getSurcharge = (temp: number): number => {
  if (temp <= 7) return 5000;
  if (temp <= 10) return 3000;
  return 0;
};

const formatPrice = (price: number): string => {
  return `¥${price.toLocaleString()}`;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Pending notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!RESEND_API_KEY || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error("Missing required environment variables");
    }

    const resend = new Resend(RESEND_API_KEY);
    const reservation: ReservationNotification = await req.json();
    const notifications = [];

    const BASE_URL = "https://www.u-sauna-private.com";
    const CONFIRMATION_URL = `${BASE_URL}/reservation/confirm/${reservation.confirmationToken}`;

    const basePrice = 40000;
    const surcharge = getSurcharge(reservation.waterTemperature);
    const totalPrice = basePrice + surcharge;

    const messageContent = `
仮予約を受け付けました。

【ご予約内容】
予約コード: ${reservation.reservationCode}
日付: ${reservation.date}
時間: ${TIME_SLOTS[reservation.timeSlot as keyof typeof TIME_SLOTS]}
人数: ${reservation.guestCount}名様
水風呂温度: ${reservation.waterTemperature}°C

【料金】
${formatPrice(totalPrice)} (税込)${surcharge > 0 ? `\n※ 水温オプション料金 +${formatPrice(surcharge)} を含む` : ''}

以下のリンクから20分以内に予約を確定してください。
${CONFIRMATION_URL}

※20分を過ぎると予約は自動的にキャンセルされます。
`;

    if (reservation.email) {
      try {
        const emailRes = await resend.emails.send({
          from: "Sauna U <onboarding@resend.dev>",
          to: [reservation.email],
          subject: "サウナのご仮予約確認",
          html: messageContent.split('\n').map(line => `<p>${line}</p>`).join(''),
        });
        console.log("Email sent successfully:", emailRes);
        notifications.push("email");
      } catch (error) {
        console.error("Email sending error:", error);
      }
    }

    try {
      const formattedPhone = formatPhoneNumber(reservation.phone);
      const formData = new URLSearchParams();
      formData.append('To', formattedPhone);
      formData.append('From', TWILIO_PHONE_NUMBER);
      formData.append('Body', messageContent);

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

      const twilioResult = await twilioResponse.json();
      if (!twilioResponse.ok) {
        throw new Error(`Twilio API error: ${JSON.stringify(twilioResult)}`);
      }
      console.log("SMS sent successfully");
      notifications.push("sms");
    } catch (error) {
      console.error("SMS sending error:", error);
    }

    return new Response(
      JSON.stringify({ success: true, notifications }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
};

serve(handler);