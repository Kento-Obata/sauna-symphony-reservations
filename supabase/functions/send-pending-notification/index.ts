
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Resend } from "https://esm.sh/resend@1.1.0"
import { Twilio } from "https://esm.sh/twilio@4.19.0"

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
const twilioClient = new Twilio(
  Deno.env.get('TWILIO_ACCOUNT_SID')!,
  Deno.env.get('TWILIO_AUTH_TOKEN')!
);
const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      date, timeSlot, guestName, guestCount, email, phone, 
      waterTemperature, reservationCode, confirmationToken,
      totalPrice 
    } = await req.json()

    const formattedDate = new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const timeSlotMap = {
      morning: '10:00-12:30',
      afternoon: '13:30-16:00',
      evening: '17:00-19:30'
    }

    const formattedTimeSlot = timeSlotMap[timeSlot]
    const confirmationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/confirm-reservation?token=${confirmationToken}`

    // Send email if email is provided
    if (email) {
      await resend.emails.send({
        from: 'sync <noreply@sync-sauna.com>',
        to: email,
        subject: '【sync】ご予約（仮）の確認',
        html: `
          <p>${guestName}様</p>
          <p>syncのご予約ありがとうございます。<br>
          以下の内容で仮予約を承りました。</p>
          <p>予約番号：${reservationCode}</p>
          <p>日時：${formattedDate} ${formattedTimeSlot}<br>
          人数：${guestCount}名様<br>
          水風呂温度：${waterTemperature}℃<br>
          料金：${totalPrice.toLocaleString()}円（税込）</p>
          <p>20分以内に下記のURLから予約を確定してください。<br>
          ${confirmationUrl}</p>
          <p>※ 20分を過ぎますと予約は自動的にキャンセルとなります。</p>
        `
      })
    }

    // Send SMS
    const smsBody = `
【sync】ご予約（仮）の確認
${guestName}様
予約番号：${reservationCode}
日時：${formattedDate} ${formattedTimeSlot}
人数：${guestCount}名様
水風呂温度：${waterTemperature}℃
料金：${totalPrice.toLocaleString()}円（税込）

20分以内に下記のURLから予約を確定してください。
${confirmationUrl}

※ 20分を過ぎますと予約は自動的にキャンセルとなります。
`.trim()

    await twilioClient.messages.create({
      body: smsBody,
      to: phone,
      from: twilioPhoneNumber
    })

    return new Response(
      JSON.stringify({ message: 'Notifications sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      },
    )
  }
})
