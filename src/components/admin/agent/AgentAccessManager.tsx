import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStaffMembers } from "@/hooks/useStaffMembers";
import { formatDateTime } from "@/components/work/workUtils";

export const AGENT_MCP_URL = `${SUPABASE_URL}/functions/v1/agent-mcp`;

const copyText = async (text: string, message: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  } catch {
    toast.error("コピーに失敗しました");
  }
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ok: { label: "実行", variant: "secondary" },
  confirmed: { label: "確認して実行", variant: "default" },
  pending_confirmation: { label: "確認待ち", variant: "outline" },
  error: { label: "失敗", variant: "destructive" },
};

const CHANNEL_LABELS: Record<string, string> = { mcp: "Claude", line: "LINE" };

const AgentConnection = () => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Claude との接続</CardTitle>
      <CardDescription>
        Claudeアプリの「設定 → コネクタ → カスタムコネクタを追加」にこのURLを登録し、管理者アカウントでログインすると、Claudeに話しかけて予約・シフト・作業管理などを操作できます。返金やお客様への送信は、実行前に必ず確認が入ります
      </CardDescription>
    </CardHeader>
    <CardContent className="flex flex-wrap items-center gap-2">
      <code className="break-all rounded bg-muted px-2 py-1 text-sm">{AGENT_MCP_URL}</code>
      <Button variant="outline" size="sm" className="gap-1" onClick={() => copyText(AGENT_MCP_URL, "URLをコピーしました")}>
        <Copy className="h-4 w-4" />
        コピー
      </Button>
    </CardContent>
  </Card>
);

const AgentApiKeys = () => {
  const queryClient = useQueryClient();
  const { data: members } = useStaffMembers();
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);

  const { data: keys } = useQuery({
    queryKey: ["agent-api-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_api_keys")
        .select("id, user_id, name, key_prefix, created_at, last_used_at, revoked_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const memberName = (id: string) => members?.find((m) => m.id === id)?.username ?? "";

  const issue = async () => {
    if (!userId || !name.trim()) {
      toast.error("誰として使うかと、用途を入れてください");
      return;
    }
    setIssuing(true);
    const { data, error } = await supabase.rpc("create_agent_api_key", { p_user_id: userId, p_name: name.trim() });
    setIssuing(false);
    if (error || !data) {
      console.error("Error creating agent api key:", error);
      toast.error("キーの発行に失敗しました");
      return;
    }
    setIssuedKey(data);
    setName("");
    await queryClient.invalidateQueries({ queryKey: ["agent-api-keys"] });
  };

  const revoke = async (id: string, keyName: string) => {
    const { error } = await supabase.from("agent_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      console.error("Error revoking agent api key:", error);
      toast.error("無効にできませんでした");
      return;
    }
    toast.success(`「${keyName}」を無効にしました`);
    await queryClient.invalidateQueries({ queryKey: ["agent-api-keys"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">APIキー（Claude Code・自動実行用）</CardTitle>
        <CardDescription>
          ログイン画面を開けない使い方（Claude Code、決まった時間に動くエージェントなど）のためのキーです。キーを知っている人は誰でも、選んだ人の権限で操作できます。使わなくなったら無効にしてください
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="誰として使うか" />
            </SelectTrigger>
            <SelectContent>
              {members?.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="用途（例: Claude Code）" className="w-56" maxLength={60} />
          <Button onClick={issue} disabled={issuing} className="gap-1">
            <KeyRound className="h-4 w-4" />
            発行
          </Button>
        </div>

        {keys && keys.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用途</TableHead>
                <TableHead>権限</TableHead>
                <TableHead>キー</TableHead>
                <TableHead>最後に使った日時</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id} className={key.revoked_at ? "text-muted-foreground" : undefined}>
                  <TableCell>{key.name}</TableCell>
                  <TableCell>{memberName(key.user_id)}</TableCell>
                  <TableCell className="font-mono text-xs">{key.key_prefix}…</TableCell>
                  <TableCell>{key.last_used_at ? formatDateTime(key.last_used_at) : "未使用"}</TableCell>
                  <TableCell className="text-right">
                    {key.revoked_at ? (
                      <Badge variant="outline">無効</Badge>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => revoke(key.id, key.name)}>
                        無効にする
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={issuedKey !== null} onOpenChange={(open) => !open && setIssuedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>APIキーを発行しました</DialogTitle>
            <DialogDescription>
              このキーは今しか表示できません。コピーして、使う場所（Claude Code の設定など）に保存してください
            </DialogDescription>
          </DialogHeader>
          <code className="break-all rounded bg-muted p-2 text-sm">{issuedKey}</code>
          <Button className="gap-1" onClick={() => issuedKey && copyText(issuedKey, "キーをコピーしました")}>
            <Copy className="h-4 w-4" />
            コピー
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

const AgentActionLogs = () => {
  const { data: members } = useStaffMembers();
  const { data: logs } = useQuery({
    queryKey: ["agent-action-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_action_logs")
        .select("id, user_id, channel, tool, tool_title, status, result_summary, error, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AIの操作ログ（直近50件）</CardTitle>
        <CardDescription>Claude・LINE から AI が行った操作の記録です</CardDescription>
      </CardHeader>
      <CardContent>
        {!logs?.length ? (
          <p className="text-sm text-muted-foreground">まだ操作はありません</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日時</TableHead>
                <TableHead>誰が</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>結果</TableHead>
                <TableHead>内容</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const status = STATUS_LABELS[log.status] ?? { label: log.status, variant: "outline" as const };
                return (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(log.created_at)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {members?.find((m) => m.id === log.user_id)?.username ?? ""}
                      <span className="ml-1 text-xs text-muted-foreground">{CHANNEL_LABELS[log.channel] ?? log.channel}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{log.tool_title ?? log.tool}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-sm" title={log.error ?? log.result_summary ?? ""}>
                      {log.error ?? log.result_summary}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export const AgentAccessManager = () => (
  <div className="space-y-6">
    <AgentConnection />
    <AgentApiKeys />
    <AgentActionLogs />
  </div>
);
