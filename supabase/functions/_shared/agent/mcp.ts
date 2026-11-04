// MCP(Model Context Protocol)の JSON-RPC 部分。セッションを持たない Streamable HTTP の
// JSON 応答だけを扱う(initialize / ping / tools/list / tools/call)。HTTP と認証は呼び出し側で行う。

import type { AgentContext, AgentTool } from "./types.ts";
import { CONFIRM_TOOL, formatToolOutput, type ToolRegistry } from "./registry.ts";

export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

export const SERVER_INFO = {
  name: "u-sauna",
  title: "U sauna 店舗管理",
  version: "1.0.0",
};

const INSTRUCTIONS = [
  "U sauna(サウナの予約制店舗)の店舗管理システムを操作するための道具です。",
  "日付は YYYY-MM-DD、時刻は日本時間です。「今日」「明日」は各道具の結果にある日付で確認してください。",
  "返金・お客様への送信など取り消せない操作は、最初の呼び出しでは実行されず確認待ちになります。",
  `内容をユーザーに見せて了承を得たときだけ ${CONFIRM_TOOL} で実行してください。`,
  "お客様の個人情報(電話番号・メールアドレス)は、業務に必要なときだけ扱ってください。",
].join("\n");

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: string | number | null; result: unknown }
  | { jsonrpc: "2.0"; id: string | number | null; error: { code: number; message: string } };

export const RPC_PARSE_ERROR = -32700;
const RPC_INVALID_REQUEST = -32600;
const RPC_METHOD_NOT_FOUND = -32601;
const RPC_INVALID_PARAMS = -32602;

export const rpcError = (id: string | number | null, code: number, message: string): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

const toMcpTool = (tool: AgentTool) => ({
  name: tool.name,
  title: tool.title,
  description: tool.description,
  inputSchema: tool.inputSchema,
  annotations: {
    title: tool.title,
    readOnlyHint: tool.kind === "read",
    destructiveHint: tool.kind === "dangerous" || tool.name === CONFIRM_TOOL,
    idempotentHint: tool.kind === "read",
    openWorldHint: false,
  },
});


async function handleOne(message: unknown, ctx: AgentContext, registry: ToolRegistry): Promise<JsonRpcResponse | null> {
  if (typeof message !== "object" || message === null || (message as JsonRpcRequest).jsonrpc !== "2.0") {
    return rpcError(null, RPC_INVALID_REQUEST, "Invalid Request");
  }
  const { id, method, params } = message as JsonRpcRequest;
  // 通知(id なし)とクライアントからの応答には返事をしない
  if (method === undefined || id === undefined) return null;

  switch (method) {
    case "initialize": {
      const requested = typeof params?.protocolVersion === "string" ? params.protocolVersion : "";
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        },
      };
    }

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: registry.list(ctx.caller.role).map(toMcpTool) } };

    case "tools/call": {
      const name = typeof params?.name === "string" ? params.name : "";
      if (!registry.has(name, ctx.caller.role)) return rpcError(id, RPC_INVALID_PARAMS, `Unknown tool: ${name}`);
      const result = await registry.call(ctx, name, params?.arguments ?? {});
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: formatToolOutput(result.output) }],
          isError: result.isError,
        },
      };
    }

    default:
      return rpcError(id, RPC_METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

/** 1件またはバッチの JSON-RPC を処理する。返す応答が無ければ null(HTTP 202) */
export async function handleMcpPayload(
  payload: unknown,
  ctx: AgentContext,
  registry: ToolRegistry,
): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  if (Array.isArray(payload)) {
    if (payload.length === 0) return rpcError(null, RPC_INVALID_REQUEST, "Invalid Request");
    const responses: JsonRpcResponse[] = [];
    for (const message of payload) {
      const response = await handleOne(message, ctx, registry);
      if (response) responses.push(response);
    }
    return responses.length > 0 ? responses : null;
  }
  return await handleOne(payload, ctx, registry);
}
