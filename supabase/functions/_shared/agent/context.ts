// 道具を動かすときの context。利用者の権限で動かす asUser は、トランザクション内で
// role=authenticated と request.jwt.claims を設定し、管理画面と同じ RLS・auth.uid() を効かせる。

import { getJstTodayYmd } from "../date-jst.ts";
import type { AgentCaller, AgentContext, Sql } from "./types.ts";

export const runAsUser = async <T>(sql: Sql, userId: string, fn: (tx: Sql) => Promise<T>): Promise<T> =>
  await sql.begin(async (tx: Sql) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
    await tx`set local role authenticated`;
    return await fn(tx);
  });

export const createAgentContext = (sql: Sql, caller: AgentCaller, todayYmd = getJstTodayYmd()): AgentContext => ({
  caller,
  sql,
  asUser: (fn) => runAsUser(sql, caller.userId, fn),
  todayYmd,
});
