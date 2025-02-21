
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
    こんにちは、${guestName}様

    サウナの予約を受け付けました。
    以下の内容で予約を承りましたので、ご確認ください。

    予約コード: ${reservationCode}
    予約日: ${date}
    時間帯: ${timeSlot}
    人数: ${guestCount}名様
    水風呂温度: ${waterTemperature}℃

    予約を確定するには、以下のリンクをクリックしてください：
    https://sauna-reservation.netlify.app/reservation/confirm/${confirmationToken}

    ※このリンクの有効期限は20分です。
  `;
};

export const generateConfirmationEmail = ({
  reservationCode,
  guestName,
  date,
  timeSlot,
  guestCount,
  waterTemperature,
  totalPrice,
}: {
  reservationCode: string;
  guestName: string;
  date: string;
  timeSlot: string;
  guestCount: number;
  waterTemperature: number;
  totalPrice: number;
}) => {
  return `
    こんにちは、${guestName}様

    ご予約ありがとうございます。
    以下の内容で予約を確定いたしました。

    予約コード: ${reservationCode}
    予約日: ${date}
    時間帯: ${timeSlot}
    人数: ${guestCount}名様
    水風呂温度: ${waterTemperature}℃
    料金: ${totalPrice}円

    当日のご来店を心よりお待ちしております。
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
