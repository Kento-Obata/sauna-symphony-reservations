
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { generatePendingEmail, sendEmail } from '../_shared/email.ts'
import { sendSMS } from '../_shared/twilio.ts'

const handler = async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const {
      date,
      timeSlot,
      guestName,
      guestCount,
      email,
      phone,
      waterTemperature,
      reservationCode,
      confirmationToken,
    } = await req.json()

    console.log('Received reservation data:', {
      date,
      timeSlot,
      guestName,
      guestCount,
      waterTemperature,
      reservationCode
    })

    // Email notification
    if (email) {
      try {
        const emailContent = generatePendingEmail({
          reservationCode,
          confirmationToken,
          guestName,
          date,
          timeSlot,
          guestCount,
          waterTemperature,
        })

        await sendEmail(email, '予約の確認', emailContent)
      } catch (error) {
        console.error('Failed to send email:', error)
      }
    }

    // SMS notification
    if (phone) {
      try {
        const smsMessage = `予約の確認をお願いします。以下のリンクから予約を確定してください。\nhttps://sauna-reservation.netlify.app/reservation/confirm/${confirmationToken}`
        await sendSMS(phone, smsMessage)
      } catch (error) {
        console.error('Failed to send SMS:', error)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}

serve(handler)
