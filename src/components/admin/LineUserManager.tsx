import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2, Copy } from "lucide-react";

const WEBHOOK_URL = "https://knjbxqiyngztylnzxzln.supabase.co/functions/v1/line-webhook";

interface LineUser {
  id: string;
  line_user_id: string;
  display_name: string;
  is_active: boolean;
  can_write: boolean;
  receive_notifications: boolean;
  created_at: string;
}

export const LineUserManager = () => {
  const qc = useQueryClient();
  const [lineUserId, setLineUserId] = useState("");
  const [displayName, setDisplayName] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["line_allowed_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("line_allowed_users")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as LineUser[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const id = lineUserId.trim();
      const name = displayName.trim();
      if (!id || !name) throw new Error("LINE userIdと表示名を入力してください");
      const { error } = await supabase
        .from("line_allowed_users")
        .insert({ line_user_id: id, display_name: name });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("追加しました");
      setLineUserId("");
      setDisplayName("");
      qc.invalidateQueries({ queryKey: ["line_allowed_users"] });
    },
    onError: (e: any) => toast.error(e.message || "追加に失敗しました"),
  });

  const updateMutation = useMutation({
    mutationFn: async (args: { id: string; patch: Partial<LineUser> }) => {
      const { error } = await supabase
        .from("line_allowed_users")
        .update(args.patch)
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["line_allowed_users"] }),
    onError: (e: any) => toast.error(e.message || "更新に失敗しました"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("line_allowed_users").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("削除しました");
      qc.invalidateQueries({ queryKey: ["line_allowed_users"] });
    },
    onError: (e: any) => toast.error(e.message || "削除に失敗しました"),
  });

  const copyWebhook = async () => {
    await navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success("Webhook URLをコピーしました");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>LINE Bot 設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Webhook URL（LINE Developersに設定）</Label>
            <div className="flex gap-2">
              <Input readOnly value={WEBHOOK_URL} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={copyWebhook}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>① LINE DevelopersでMessaging APIチャネルを作成し、Webhook URLに上記を設定して「Use webhook」をON</p>
            <p>② スタッフが公式アカウントを友だち追加し、「ID」と送信</p>
            <p>③ 返信されたuserIdを下のフォームから登録</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>許可ユーザー追加</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
            <div className="space-y-1">
              <Label>LINE userId</Label>
              <Input
                placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={lineUserId}
                onChange={(e) => setLineUserId(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>表示名</Label>
              <Input
                placeholder="山田太郎"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              追加
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>許可ユーザー一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : !users || users.length === 0 ? (
            <p className="text-sm text-muted-foreground">登録されていません</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>表示名</TableHead>
                  <TableHead>LINE userId</TableHead>
                  <TableHead className="text-center">有効</TableHead>
                  <TableHead className="text-center">書込権限</TableHead>
                  <TableHead className="text-center">通知受信</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.display_name}</TableCell>
                    <TableCell className="font-mono text-xs">{u.line_user_id}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={u.is_active}
                        onCheckedChange={(v) =>
                          updateMutation.mutate({ id: u.id, patch: { is_active: v } })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={u.can_write}
                        onCheckedChange={(v) =>
                          updateMutation.mutate({ id: u.id, patch: { can_write: v } })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={u.receive_notifications}
                        onCheckedChange={(v) =>
                          updateMutation.mutate({
                            id: u.id,
                            patch: { receive_notifications: v },
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`「${u.display_name}」を削除しますか？`)) {
                            deleteMutation.mutate(u.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
