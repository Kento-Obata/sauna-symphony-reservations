// LINE のメンション。グループでは、ボットに @ でメンションしたメッセージだけ AI が受ける。
// webhook の message.mention.mentionees: index・length は本文中の位置、isSelf はボット自身へのメンション。

export interface LineMentionee {
  index: number;
  length: number;
  type?: string;
  userId?: string;
  isSelf?: boolean;
}

/** ボットへのメンションがあるか(@All は含めない) */
export const mentionsBot = (mentionees: LineMentionee[] | undefined): boolean =>
  (mentionees ?? []).some((m) => m.isSelf === true);

/** ボットへのメンション部分を取り除いた本文(ほかの人へのメンションは残す) */
export const stripBotMention = (text: string, mentionees: LineMentionee[] | undefined): string => {
  const spans = (mentionees ?? [])
    .filter((m) => m.isSelf === true && Number.isInteger(m.index) && Number.isInteger(m.length))
    .sort((a, b) => b.index - a.index);
  let out = text;
  for (const m of spans) out = out.slice(0, m.index) + out.slice(m.index + m.length);
  return out.trim();
};
