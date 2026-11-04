// 道具の一覧と呼び出し。権限の確認・入力の検証・実行前の確認・操作ログをここでまとめて行う。

import { validateInput } from "./validate.ts";
import { type AgentContext, type AgentRole, type AgentTool, ToolError, type ToolOutput } from "./types.ts";

export type CallStatus = "ok" | "error" | "pending_confirmation" | "confirmed";

export interface ToolCallResult {
  isError: boolean;
  status: CallStatus;
  output: ToolOutput;
}

export const CONFIRM_TOOL = "confirm_action";

/** AI に返す形(要約 + 詳細の JSON)。MCP と LINE で共通 */
export const formatToolOutput = ({ text, data }: ToolOutput): string =>
  data === undefined ? text : `${text}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
export const CONFIRM_TTL_MINUTES = 10;

/** 確認待ちの控えと操作ログの保存先。テストでは差し替える */
export interface AgentStore {
  createPending(ctx: AgentContext, tool: string, input: Record<string, unknown>, summary: string): Promise<string>;
  /** 本人の・期限内の・未使用の控えを使用済みにして返す */
  takePending(ctx: AgentContext, id: string): Promise<{ tool: string; input: Record<string, unknown> } | null>;
  log(ctx: AgentContext, entry: {
    tool: string;
    title?: string;
    input: unknown;
    status: CallStatus;
    resultSummary?: string;
    error?: string;
  }): Promise<void>;
}

export const sqlAgentStore: AgentStore = {
  async createPending(ctx, tool, input, summary) {
    const rows = await ctx.sql`
      insert into public.agent_pending_actions (user_id, tool, input, summary, expires_at)
      values (${ctx.caller.userId}::uuid, ${tool}, ${ctx.sql.json(input)}::jsonb, ${summary},
              now() + make_interval(mins => ${CONFIRM_TTL_MINUTES}))
      returning id::text
    `;
    return rows[0].id;
  },
  async takePending(ctx, id) {
    const rows = await ctx.sql`
      update public.agent_pending_actions
      set used_at = now()
      where id = ${id}::uuid
        and user_id = ${ctx.caller.userId}::uuid
        and used_at is null
        and expires_at > now()
      returning tool, input
    `;
    return rows[0] ?? null;
  },
  async log(ctx, entry) {
    try {
      await ctx.sql`
        insert into public.agent_action_logs (user_id, channel, client, tool, tool_title, input, status, result_summary, error)
        values (${ctx.caller.userId}::uuid, ${ctx.caller.channel}, ${ctx.caller.client}, ${entry.tool}, ${entry.title ?? null},
                ${entry.input === undefined ? null : ctx.sql.json(entry.input)}::jsonb, ${entry.status},
                ${entry.resultSummary?.slice(0, 500) ?? null}, ${entry.error?.slice(0, 500) ?? null})
      `;
    } catch (error) {
      console.error("agent_action_logs insert failed:", error);
    }
  },
};

const UNEXPECTED_ERROR = "内部エラーで実行できませんでした\u3000時間をおいて再度お試しください";

export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>();

  constructor(tools: AgentTool[], private readonly store: AgentStore = sqlAgentStore) {
    for (const tool of [...tools, this.confirmTool()]) {
      if (this.tools.has(tool.name)) throw new Error(`duplicate tool: ${tool.name}`);
      if (tool.kind === "dangerous" && !tool.preview) throw new Error(`dangerous tool needs preview: ${tool.name}`);
      this.tools.set(tool.name, tool);
    }
  }

  private writeLog(ctx: AgentContext, entry: Parameters<AgentStore["log"]>[1]) {
    return this.store.log(ctx, { ...entry, title: this.tools.get(entry.tool)?.title });
  }

  list(role: AgentRole): AgentTool[] {
    const tools = [...this.tools.values()].filter((t) => t.roles.includes(role));
    // 確認の要る道具が無い人には confirm_action も見せない
    return tools.some((t) => t.kind === "dangerous") ? tools : tools.filter((t) => t.name !== CONFIRM_TOOL);
  }

  has(name: string, role: AgentRole): boolean {
    return this.list(role).some((t) => t.name === name);
  }

  async call(ctx: AgentContext, name: string, rawInput: unknown): Promise<ToolCallResult> {
    const tool = this.tools.get(name);
    if (!tool || !this.has(name, ctx.caller.role)) {
      return { isError: true, status: "error", output: { text: `「${name}」は使えません` } };
    }

    const validated = validateInput(tool.inputSchema, rawInput);
    if (!validated.ok) {
      const text = `入力が正しくありません\n${validated.errors.join("\n")}`;
      await this.writeLog(ctx, { tool: name, input: rawInput, status: "error", error: text });
      return { isError: true, status: "error", output: { text } };
    }
    const input = validated.value;

    try {
      if (tool.kind === "dangerous") {
        const summary = await tool.preview!(ctx, input);
        const confirmationId = await this.store.createPending(ctx, name, input, summary);
        await this.writeLog(ctx, { tool: name, input, status: "pending_confirmation", resultSummary: summary });
        return {
          isError: false,
          status: "pending_confirmation",
          output: {
            text: [
              "まだ実行していません。",
              summary,
              "",
              `この内容で実行してよいか、必ずユーザーに確認してください。了承を得たら ${CONFIRM_TOOL} を confirmation_id="${confirmationId}" で呼ぶと実行します(${CONFIRM_TTL_MINUTES}分以内)。`,
            ].join("\n"),
            data: { confirmation_id: confirmationId, expires_in_minutes: CONFIRM_TTL_MINUTES },
          },
        };
      }

      const output = await tool.run(ctx, input);
      await this.writeLog(ctx, { tool: name, input, status: "ok", resultSummary: output.text });
      return { isError: false, status: "ok", output };
    } catch (error) {
      return await this.failure(ctx, name, input, error);
    }
  }

  private async failure(ctx: AgentContext, tool: string, input: unknown, error: unknown): Promise<ToolCallResult> {
    if (error instanceof ToolError) {
      await this.writeLog(ctx, { tool, input, status: "error", error: error.message });
      return { isError: true, status: "error", output: { text: error.message } };
    }
    console.error(`agent tool ${tool} failed:`, error);
    await this.writeLog(ctx, { tool, input, status: "error", error: String(error) });
    return { isError: true, status: "error", output: { text: UNEXPECTED_ERROR } };
  }

  /** 確認待ちの操作を実行する。実行するのは確認時に控えた入力そのもので、AI が後から変えることはできない */
  private confirmTool(): AgentTool<{ confirmation_id: string }> {
    return {
      name: CONFIRM_TOOL,
      title: "確認済みの操作を実行",
      description:
        "返金・お客様への送信などの操作は、最初の呼び出しでは実行されず confirmation_id が返ります。" +
        "その内容をユーザーに見せて了承を得たときだけ、この道具で実行してください。ユーザーの了承なしに呼んではいけません。",
      inputSchema: {
        type: "object",
        properties: { confirmation_id: { type: "string", format: "uuid", description: "確認待ちの操作の ID" } },
        required: ["confirmation_id"],
        additionalProperties: false,
      },
      roles: ["admin", "staff"],
      kind: "write",
      run: async (ctx, { confirmation_id }) => {
        const pending = await this.store.takePending(ctx, confirmation_id);
        if (!pending) {
          throw new ToolError("確認の期限が切れたか、すでに実行済みです\u3000もう一度最初からやり直してください");
        }
        const tool = this.tools.get(pending.tool);
        if (!tool || !tool.roles.includes(ctx.caller.role)) throw new ToolError(`「${pending.tool}」は使えません`);
        try {
          const output = await tool.run(ctx, pending.input);
          await this.writeLog(ctx, { tool: pending.tool, input: pending.input, status: "confirmed", resultSummary: output.text });
          return output;
        } catch (error) {
          await this.writeLog(ctx, { tool: pending.tool, input: pending.input, status: "error", error: String(error) });
          throw error;
        }
      },
    };
  }
}
