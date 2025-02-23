export const generatePendingEmail = ({
  reservationCode,
  confirmationToken,
  guestName,
  date,
  timeSlot,
  guestCount,
  waterTemperature,
}: {
  reservationCode: string;
  confirmationToken: string;
  guestName: string;
  date: string;
  timeSlot: string;
  guestCount: number;
  waterTemperature: number;
}) => {
  return `
    ${guestName}様

    ※ まだ予約は完了していません。
    以下のリンクから20分以内に予約を確定してください。
    https://sauna-reservation.netlify.app/reservation/confirm/${confirmationToken}

    【ご予約内容】
    予約コード: ${reservationCode}
    予約日: ${date}
    時間帯: ${timeSlot}
    人数: ${guestCount}名様
    水風呂温度: ${waterTemperature}℃

    ※ 20分を過ぎると予約は自動的にキャンセルされます。
  `;
};

export const sendEmail = async (to: string, subject: string, message: string) => {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');

  if (!resendApiKey) {
    throw new Error('Missing Resend API key');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: 'no-reply@yourdomain.com',
      to,
      subject,
      text: message,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.statusText}`);
  }

  return response.json();
};
