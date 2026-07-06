export const sendLineGroupMessage = async (message: string) => {
  const channelAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
  const groupId = Deno.env.get('STAFF_PUSH_GROUP_ID');

  if (!channelAccessToken || !groupId) {
    throw new Error('Missing LINE credentials (LINE_CHANNEL_ACCESS_TOKEN or STAFF_PUSH_GROUP_ID)');
  }

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: 'text', text: message }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LINE API error (${response.status}): ${body}`);
  }

  return response;
};
