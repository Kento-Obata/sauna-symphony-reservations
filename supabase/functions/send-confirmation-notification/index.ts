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
  if (temp <= 10) return 5000;
  if (temp <= 14) return 3000;
  return 0;
};

const isPreOpeningPeriod = (date: Date): boolean => {
  return date.getFullYear() === 2025 && date.getMonth() === 2;
};

const getPricePerPersonRegular = (guestCount: number): number => {
  if (guestCount === 2) return 7500;
  if (guestCount === 3 || guestCount === 4) return 7000;
  if (guestCount === 5 || guestCount === 6) return 6000;
  return 7500;
};

const getPricePerPerson = (guestCount: number, date: Date): number => {
  if (isPreOpeningPeriod(date)) {
    return 5000;
  }
  return getPricePerPersonRegular(guestCount);
};

const calculateTotalPrice = (guestCount: number, waterTemperature: number, date: Date): number => {
  const pricePerPerson = getPricePerPerson(guestCount, date);
  const basePrice = pricePerPerson * guestCount;
  const surcharge = getSurcharge(waterTemperature);
  return basePrice + surcharge;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Confirmation notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { 
      headers: { ...corsHeaders }
    });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

    console.log("Environment variables check:", {
      hasResendKey: !!RESEND_API_KEY,
      hasTwilioSid: !!TWILIO_ACCOUNT_SID,
      hasTwilioToken: !!TWILIO_AUTH_TOKEN,
      hasPhoneNumber: !!TWILIO_PHONE_NUMBER
    });

    if (!RESEND_API_KEY || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error("Missing required environment variables");
      throw new Error("Server configuration error");
    }

    const resend = new Resend(RESEND_API_KEY);
    const reservation: ReservationNotification = await req.json();
    console.log("Received reservation data:", {
      ...reservation,
      phone: "REDACTED"
    });

    const notifications = [];
    const GOOGLE_MAPS_URL = "https://maps.google.com/maps?q=8Q5GHG7V%2BJ5";

    const reservationDate = new Date(reservation.date);
    const totalPrice = calculateTotalPrice(
      reservation.guestCount,
      15,
      reservationDate
    );

    console.log("Price calculation:", {
      date: reservationDate,
      guestCount: reservation.guestCount,
      waterTemperature: 15,
      totalPrice: totalPrice
    });

    const messageContent = `
ご予約いただきありがとうございます！

【ご予約内容】
予約コード: ${reservation.reservationCode}
日付: ${reservation.date}
時間: ${TIME_SLOTS[reservation.timeSlot as keyof typeof TIME_SLOTS]}
人数: ${reservation.guestCount}名様
水風呂温度: 15°C
料金: ¥${totalPrice.toLocaleString()} (税込)

【受付時間】
ご予約時間の15分前からご案内いたします。

【設備・アメニティ】
タオル、水着はご用意しております。
アメニティは、シャンプー / リンス / フェイシャルパック / 化粧水 を用意しております。

【アクセス】
住所: 〒811-2127 福岡県糟屋郡宇美町障子岳6-8-4
Plus Code: 8Q5GHG7V+J5
Google Maps: ${GOOGLE_MAPS_URL}

心よりお待ちしております。
`;

    if (reservation.email) {
      try {
        console.log("Attempting to send email to:", reservation.email);
        const emailRes = await resend.emails.send({
          from: "Sauna U <onboarding@resend.dev>",
          to: [reservation.email],
          subject: "サウナのご予約確定のお知らせ",
          html: `
            <h1>ご予約ありがとうございます</h1>
            <p>${reservation.guestName}様</p>
            ${messageContent.split('\n').map(line => `<p>${line}</p>`).join('')}
          `,
        });
        console.log("Email sent successfully:", emailRes);
        notifications.push("email");
      } catch (error) {
        console.error("Email sending error:", error);
      }
    }

    try {
      const formattedPhone = formatPhoneNumber(reservation.phone);
      console.log("Attempting to send SMS to formatted number:", formattedPhone);

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
      console.log("Twilio API Response:", twilioResult);

      if (!twilioResponse.ok) {
        throw new Error(`Twilio API error: ${JSON.stringify(twilioResult)}`);
      }

      console.log("SMS sent successfully");
      notifications.push("sms");
    } catch (error) {
      console.error("SMS sending error:", error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications: notifications,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Function error:", error);
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
