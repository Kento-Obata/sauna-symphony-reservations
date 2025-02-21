
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors'
import { generateConfirmationEmail, sendEmail } from '../_shared/email'
import { sendSMS } from '../_shared/twilio'
import { parseJSON, zonedTimeToUtc } from 'https://esm.sh/date-fns-tz@3.0.1'

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
      reservationDate,
    } = await req.json()

    console.log('Received data:', { reservationDate })
    
    // 文字列として受け取った日付をJSTとして解釈し、UTC時刻に変換
    const parsedDate = parseJSON(reservationDate)
    console.log('Parsed date:', parsedDate)

    const jstDate = zonedTimeToUtc(parsedDate, 'Asia/Tokyo')
    console.log('Converted to UTC:', jstDate)

    // Email notification
    if (email) {
      try {
        const emailContent = generateConfirmationEmail({
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

Deno.serve(handler)
