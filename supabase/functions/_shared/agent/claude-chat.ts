// LINE bot 用: Claude に店の道具を使わせて、1回分の返事を作る(tool use のループ)。
// 道具の実行は MCP と同じ ToolRegistry を通すので、権限・入力の検証・実行前の確認・操作ログは共通。
//
// 会話の履歴は追記だけにする(過去のメッセージを書き換えたり、古い順に削ったりしない)。
// system と tools も会話の途中で変えない。Claude の thinking ブロックは前の内容と結びついていて、
// 書き換えると無効になる(新しいアカウントでは 400)ため。長くなった会話は呼び出し側で新しく始め直す。

import Anthropic from "npm:@anthropic-ai/sdk@1.4.0";
import { formatToolOutput, type ToolRegistry } from "./registry.ts";
import type { AgentContext } from "./types.ts";

export const CHAT_MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 8;

export type ChatMessage = Anthropic.Beta.BetaMessageParam;

/** テストで差し替えられるように、使うのは beta.messages.create だけ */
export interface ChatClient {
  beta: { messages: { create(params: Anthropic.Beta.MessageCreateParamsNonStreaming): Promise<Anthropic.Beta.BetaMessage> } };
}

export interface ChatTurnResult {
  reply: string;
  /** 今回足したメッセージ(assistant と tool_result)。呼び出し側が履歴の末尾に追記して保存する */
  appended: ChatMessage[];
}

export const claudeToolsFor = (registry: ToolRegistry, ctx: AgentContext): Anthropic.Beta.BetaTool[] =>
  registry.list(ctx.caller.role).map((tool) => ({
    name: tool.name,
    description: `${tool.title}: ${tool.description}`,
    input_schema: tool.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
  }));

const textOf = (content: Anthropic.Beta.BetaContentBlock[]) =>
  content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

export async function runChatTurn(params: {
  client: ChatClient;
  registry: ToolRegistry;
  ctx: AgentContext;
  system: string;
  /** これまでの会話 + 今回のユーザーのメッセージ */
  history: ChatMessage[];
}): Promise<ChatTurnResult> {
  const { client, registry, ctx, system } = params;
  const tools = claudeToolsFor(registry, ctx);
  const messages = [...params.history];
  const appended: ChatMessage[] = [];
  const push = (message: ChatMessage) => {
    messages.push(message);
    appended.push(message);
  };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.beta.messages.create({
      model: CHAT_MODEL,
      max_tokens: 16000,
      // 安全上の理由で断られたときは、サーバー側で別のモデルに切り替えて続ける
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // LINE の短いやりとり向け。道具の呼び出しが少なく、返事が速い
      output_config: { effort: "low" },
      cache_control: { type: "ephemeral" },
      system,
      tools,
      messages,
    });
    // thinking ブロックを含めて、そのまま履歴に戻す
    push({ role: "assistant", content: response.content });

    if (response.stop_reason === "refusal") {
      return { reply: "すみません、この内容にはお答えできません", appended };
    }
    if (response.stop_reason === "pause_turn") continue;
    if (response.stop_reason !== "tool_use") {
      return { reply: textOf(response.content) || "返事を作れませんでした\u3000もう一度送ってください", appended };
    }

    // 1回の返事に複数の道具の呼び出しがあれば、結果はまとめて1つのメッセージで返す
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const result = await registry.call(ctx, block.name, block.input);
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: formatToolOutput(result.output),
        is_error: result.isError,
      });
    }
    push({ role: "user", content: results });
  }

  return { reply: "やりとりが長くなったので、いったん止めました\u3000もう一度、短く頼んでください", appended };
}
