import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { format } from "https://deno.land/std@0.190.0/datetime/mod.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReservationNotification {
  date: string;
  timeSlot: string;
  guestName: string;
  guestCount: number;
  email: string | null;
  phone: string;
  waterTemperature: number;
}

const TIME_SLOTS = {
  morning: "10:00-12:30",
  afternoon: "13:30-16:00",
  evening: "17:00-19:30",
};

const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If it's a Japanese number starting with 0
  if (digits.startsWith('0')) {
    // Remove the leading 0 and add +81
    return '+81' + digits.slice(1);
  }
  
  // If it already has a country code (starts with non-zero)
  if (!digits.startsWith('0')) {
    return '+' + digits;
  }
  
  return digits;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Notification function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const reservation: ReservationNotification = await req.json();
    console.log("Received reservation:", reservation);

    const notifications = [];

    // Send email if provided
    if (reservation.email) {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Sauna Reservation <onboarding@resend.dev>",
            to: [reservation.email],
            subject: "Your Sauna Reservation Confirmation",
            html: `
              <h1>Reservation Confirmation</h1>
              <p>Dear ${reservation.guestName},</p>
              <p>Your sauna reservation has been confirmed with the following details:</p>
              <ul>
                <li>Date: ${reservation.date}</li>
                <li>Time: ${TIME_SLOTS[reservation.timeSlot as keyof typeof TIME_SLOTS]}</li>
                <li>Number of guests: ${reservation.guestCount}</li>
                <li>Water temperature: ${reservation.waterTemperature}°C</li>
              </ul>
              <p>We look forward to seeing you!</p>
            `,
          }),
        });

        if (!emailRes.ok) {
          throw new Error(`Email sending failed: ${await emailRes.text()}`);
        }
        console.log("Email sent successfully");
        notifications.push("email");
      } catch (error) {
        console.error("Error sending email:", error);
      }
    }

    // Send SMS using Twilio
    try {
      const formattedPhone = formatPhoneNumber(reservation.phone);
      console.log("Original phone:", reservation.phone);
      console.log("Formatted phone:", formattedPhone);

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const formData = new URLSearchParams();
      formData.append('To', formattedPhone);
      formData.append('From', TWILIO_PHONE_NUMBER);
      formData.append('Body', `Your sauna reservation is confirmed!\nDate: ${reservation.date}\nTime: ${
        TIME_SLOTS[reservation.timeSlot as keyof typeof TIME_SLOTS]
      }\nGuests: ${reservation.guestCount}\nWater temp: ${
        reservation.waterTemperature
      }°C`);

      console.log("Sending SMS to:", formattedPhone);
      console.log("SMS content:", formData.toString());

      const smsRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        },
        body: formData,
      });

      const smsResponseText = await smsRes.text();
      console.log("Twilio API response:", smsResponseText);

      if (!smsRes.ok) {
        throw new Error(`SMS sending failed: ${smsResponseText}`);
      }
      console.log("SMS sent successfully");
      notifications.push("sms");
    } catch (error) {
      console.error("Error sending SMS:", error);
      throw error;
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
    console.error("Error in notification function:", error);
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