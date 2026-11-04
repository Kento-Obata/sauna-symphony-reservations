import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import type Anthropic from "npm:@anthropic-ai/sdk@1.4.0";
import { type ChatClient, type ChatMessage, runChatTurn } from "./claude-chat.ts";
import { type AgentStore, ToolRegistry } from "./registry.ts";
import type { AgentContext, AgentTool } from "./types.ts";

const noopStore: AgentStore = {
  createPending: () => Promise.resolve("00000000-0000-0000-0000-000000000000"),
  takePending: () => Promise.resolve(null),
  log: () => Promise.resolve(),
};

const ctx: AgentContext = {
  caller: { userId: "u1", role: "staff", name: "検証開晴", channel: "line", client: "line" },
  sql: null,
  asUser: () => Promise.reject(new Error("not used")),
  todayYmd: "2026-11-04",
};

const calls: unknown[] = [];
const myShifts: AgentTool = {
  name: "my_shifts",
  title: "自分のシフト",
  description: "",
  inputSchema: { type: "object", properties: { from: { type: "string", format: "date" } }, required: ["from"] },
  roles: ["staff"],
  kind: "read",
  run: (_ctx, input) => {
    calls.push(input);
    return Promise.resolve({ text: "11/5 10:00-15:00" });
  },
};

const message = (stop_reason: Anthropic.Beta.BetaStopReason, content: unknown[]): Anthropic.Beta.BetaMessage =>
  ({ id: "msg", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason, content, usage: {} }) as unknown as Anthropic.Beta.BetaMessage;

const scripted = (responses: Anthropic.Beta.BetaMessage[]) => {
  const requests: Anthropic.Beta.MessageCreateParamsNonStreaming[] = [];
  const client: ChatClient = {
    beta: {
      messages: {
        create: (params) => {
          requests.push(structuredClone(params));
          return Promise.resolve(responses.shift()!);
        },
      },
    },
  };
  return { client, requests };
};

Deno.test("chat: 道具を呼んで結果を返し、最後の文章を返事にする。履歴は追記だけ", async () => {
  calls.length = 0;
  const registry = new ToolRegistry([myShifts], noopStore);
  const { client, requests } = scripted([
    message("tool_use", [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "tool_use", id: "t1", name: "my_shifts", input: { from: "2026-11-04" } },
    ]),
    message("end_turn", [{ type: "text", text: "明日は10時からです" }]),
  ]);
  const history: ChatMessage[] = [{ role: "user", content: "明日のシフトは？" }];

  const result = await runChatTurn({ client, registry, ctx, system: "S", history });

  assertEquals(result.reply, "明日は10時からです");
  assertEquals(calls, [{ from: "2026-11-04" }]);
  assertEquals(result.appended.length, 3); // assistant(tool_use) / user(tool_result) / assistant(text)
  // 2回目のリクエストは1回目の内容をそのまま含む(thinking ブロックも戻す)
  assertEquals(requests[1].messages.slice(0, 2), [history[0], { role: "assistant", content: requests[1].messages[1].content }]);
  assertEquals((requests[1].messages[1].content as { type: string }[])[0].type, "thinking");
  const toolResult = (requests[1].messages[2].content as Anthropic.Beta.BetaToolResultBlockParam[])[0];
  assertEquals(toolResult.tool_use_id, "t1");
  assert(!toolResult.is_error);
  // system と tools はどのリクエストでも同じ
  assertEquals(requests[0].system, requests[1].system);
  assertEquals(requests[0].tools, requests[1].tools);
  assertEquals(requests[0].fallbacks, "default");
});

Deno.test("chat: 使えない道具・入力の誤りは is_error で返し、断られたら定型文", async () => {
  const registry = new ToolRegistry([myShifts], noopStore);
  const { client, requests } = scripted([
    message("tool_use", [
      { type: "tool_use", id: "a", name: "refund", input: {} },
      { type: "tool_use", id: "b", name: "my_shifts", input: { from: "明日" } },
    ]),
    message("refusal", []),
  ]);
  const result = await runChatTurn({ client, registry, ctx, system: "S", history: [{ role: "user", content: "x" }] });
  const results = requests[1].messages[2].content as Anthropic.Beta.BetaToolResultBlockParam[];
  assertEquals(results.map((r) => r.is_error), [true, true]);
  assertEquals(result.reply, "すみません、この内容にはお答えできません");
});
