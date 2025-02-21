
export const sendSMS = async (to: string, message: string) => {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Missing Twilio credentials');
  }

  // Twilioの電話番号形式を確認（国際形式に変換）
  const formattedTo = to.startsWith('+') ? to : `+81${to.replace(/^0/, '')}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const formData = new URLSearchParams({
    To: formattedTo,
    From: fromNumber,
    Body: message,
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
