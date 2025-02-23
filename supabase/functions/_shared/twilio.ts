
export const sendSMS = async (to: string, message: string) => {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Missing Twilio credentials');
  }

  const formattedTo = to.startsWith('+') ? to : `+81${to.replace(/^0/, '')}`;

  // SMSの文言を短く修正
  const smsMessage = `
※まだ予約は完了していません。
以下のリンクから20分以内に予約を確定してください。
${message}

予約コード: ${reservationCode}

※20分を過ぎると予約は自動的にキャンセルされます。`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const formData = new URLSearchParams({
    To: formattedTo,
    From: fromNumber,
    Body: smsMessage,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Twilio API Error:', errorData);
    throw new Error(`Failed to send SMS: ${response.statusText}`);
  }

  return response.json();
};
