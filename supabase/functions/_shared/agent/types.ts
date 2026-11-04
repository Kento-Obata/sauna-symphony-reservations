// AIエージェント用の道具(tool)の型。MCP(Claudeアプリ等)と LINE bot の両方から同じ定義を使う。

// deno-lint-ignore no-explicit-any
export type Sql = any; // postgresjs の接続(型パッケージ非導入のため)

export type AgentRole = "admin" | "staff";
export type AgentChannel = "mcp" | "line";

/** 呼び出した人。権限の判定と操作ログに使う */
export interface AgentCaller {
  userId: string;
  role: AgentRole;
  name: string;
  channel: AgentChannel;
  /** OAuth の client_id / API キーの名前 / "line" */
  client: string | null;
  /** LINE のグループ(・複数人トーク)で話しているときのグループ ID */
  lineGroupId?: string | null;
}

export interface AgentContext {
  caller: AgentCaller;
  /** postgres ロールの接続(RLS を通らない)。権限の確認は道具側で行うこと */
  sql: Sql;
  /** 呼び出した人の権限(RLS)で SQL を実行する */
  asUser: <T>(fn: (tx: Sql) => Promise<T>) => Promise<T>;
  /** 今日の日付(JST, YYYY-MM-DD)。テストで差し替えられるように context に持たせる */
  todayYmd: string;
}

/** read: 見るだけ / write: そのまま実行してよい変更 / dangerous: 実行前にユーザーの確認が要る */
export type ToolKind = "read" | "write" | "dangerous";

export interface ToolOutput {
  /** AI に返す要約(日本語) */
  text: string;
  /** 詳細(JSON で添える) */
  data?: unknown;
}

// 入力の検証に使う JSON Schema(使う範囲だけ)
export interface JsonSchema {
  type?: "object" | "string" | "integer" | "number" | "boolean" | "array";
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  enum?: (string | number)[];
  format?: "date" | "uuid" | "time";
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  default?: unknown;
}

export interface AgentTool<I = Record<string, unknown>> {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema & { type: "object" };
  roles: AgentRole[];
  kind: ToolKind;
  // 入力は inputSchema で検証済みのものが渡る。メソッド記法にしているのは、入力の型が違う道具を
  // AgentTool[] にまとめられるようにするため(引数の型が双変になる)
  /** dangerous のとき必須: 確認のために「何が起きるか」を具体的に書く(まだ実行しない) */
  preview?(ctx: AgentContext, input: I): Promise<string>;
  run(ctx: AgentContext, input: I): Promise<ToolOutput>;
}

/** 利用者に見せてよい失敗(入力の誤り・見つからない等)。それ以外の例外は内部エラーとして扱う */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}
