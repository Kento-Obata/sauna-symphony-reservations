import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { Resend } from "https://esm.sh/resend@2.0.0"
import { Twilio } from "https://esm.sh/twilio@4.19.0"

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
const twilioClient = new Twilio(
  Deno.env.get('TWILIO_ACCOUNT_SID'),
  Deno.env.get('TWILIO_AUTH_TOKEN')
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReservationData {
  guestName: string
  email: string | null
  phone: string
  reservationCode: string
  date: string
  timeSlot: string
}

Deno.serve(async (req) => {
  console.log("Expiration notification function called")

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const reservationData: ReservationData = await req.json()
    console.log('Received reservation data:', reservationData)
    const { guestName, email, phone, reservationCode, date, timeSlot } = reservationData

    console.log('Starting to send notifications')

    // Send email if email is provided
    if (email) {
      console.log('Sending expiration email to:', email)
      try {
        await resend.emails.send({
          from: 'Sauna Reservation <onsen@resend.dev>',
          to: email,
          subject: '予約が期限切れになりました',
          html: `
            <p>${guestName}様</p>
            <p>ご予約の確認が1分以内に完了しなかったため、予約番号${reservationCode}の予約は期限切れとなりました。</p>
            <p>予約内容:</p>
            <ul>
              <li>日付: ${date}</li>
              <li>時間帯: ${timeSlot}</li>
            </ul>
            <p>もう一度ご予約いただけますと幸いです。</p>
          `
        })
        console.log('Email sent successfully')
      } catch (error) {
        console.error('Error sending email:', error)
      }
    }

    // Send SMS
    console.log('Sending expiration SMS to:', phone)
    try {
      await twilioClient.messages.create({
        body: `${guestName}様、予約番号${reservationCode}の予約は確認が完了しなかったため期限切れとなりました。もう一度ご予約ください。`,
        from: Deno.env.get('TWILIO_PHONE_NUMBER'),
        to: phone
      })
      console.log('SMS sent successfully')
    } catch (error) {
      console.error('Error sending SMS:', error)
    }

    return new Response(
      JSON.stringify({ message: 'Expiration notifications sent successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in expiration notification function:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to send expiration notifications' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})