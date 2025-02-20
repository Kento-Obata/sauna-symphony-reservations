
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { token } = await req.json()

    // Get reservation details
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('*')
      .eq('confirmation_token', token)
      .single()

    if (fetchError || !reservation) {
      throw new Error('Reservation not found')
    }

    const formattedDate = new Date(reservation.date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const timeSlotMap = {
      morning: '10:00-12:30',
      afternoon: '13:30-16:00',
      evening: '17:00-19:30'
    }

    const formattedTimeSlot = timeSlotMap[reservation.time_slot]

    // Update reservation status
    const { error: updateError } = await supabase
      .from('reservations')
      .update({
        status: 'confirmed',
        is_confirmed: true,
      })
      .eq('confirmation_token', token)

    if (updateError) {
      throw updateError
    }

    // Send email if email is provided
    if (reservation.email) {
      await resend.emails.send({
        from: 'sync <noreply@sync-sauna.com>',
        to: reservation.email,
        subject: '【sync】ご予約の確定',
        html: `
          <p>${reservation.guest_name}様</p>
          <p>syncのご予約が確定いたしました。</p>
          <p>予約番号：${reservation.reservation_code}</p>
          <p>日時：${formattedDate} ${formattedTimeSlot}<br>
          人数：${reservation.guest_count}名様<br>
          水風呂温度：${reservation.water_temperature}℃<br>
          料金：${reservation.total_price.toLocaleString()}円（税込）</p>
          <p>当日は予約番号をご提示ください。<br>
          受付開始は、ご予約時間の15分前からとなります。</p>
        `
      })
    }

    // Send SMS
    const smsBody = `
【sync】ご予約の確定
${reservation.guest_name}様

予約番号：${reservation.reservation_code}
日時：${formattedDate} ${formattedTimeSlot}
人数：${reservation.guest_count}名様
水風呂温度：${reservation.water_temperature}℃
料金：${reservation.total_price.toLocaleString()}円（税込）

当日は予約番号をご提示ください。
受付開始は、ご予約時間の15分前からとなります。
`.trim()

    await twilioClient.messages.create({
      body: smsBody,
      to: reservation.phone,
      from: twilioPhoneNumber
    })

    return new Response(
      JSON.stringify({ success: true, reservation_code: reservation.reservation_code }),
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
