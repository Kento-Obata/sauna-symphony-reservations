import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStaffMembers } from "@/hooks/useStaffMembers";
import { staffWorkUrl } from "../workUtils";

export const StaffWorkLinks = () => {
  const queryClient = useQueryClient();
  const { data: staffMembers } = useStaffMembers();

  const { data: tokens } = useQuery({
    queryKey: ["staff-access-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_access_tokens").select("staff_id, token");
      if (error) throw error;
      return new Map(data.map((row) => [row.staff_id, row.token]));
    },
  });

  const copy = async (token: string, name: string | null) => {
    try {
      await navigator.clipboard.writeText(staffWorkUrl(token));
      toast.success(`${name}さんのリンクをコピーしました`);
    } catch {
      toast.error("コピーに失敗しました");
    }
  };

  // 発行・再発行。再発行すると古いリンクは使えなくなる
  const issue = async (staffId: string, name: string | null) => {
    const token = crypto.randomUUID();
    const { error } = await supabase
      .from("staff_access_tokens")
      .upsert({ staff_id: staffId, token, created_at: new Date().toISOString() }, { onConflict: "staff_id" });
    if (error) {
      console.error("Error issuing staff token:", error);
      toast.error("リンクの発行に失敗しました");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["staff-access-tokens"] });
    await copy(token, name);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">スタッフ用リンク</CardTitle>
        <CardDescription>
          スタッフはこのリンクをスマホで開き、ホーム画面に追加して使います。ログイン不要で作業の記録・タスク登録・自分のポイント確認ができます。リンクを知っている人は誰でもその人として記録できるので、本人にだけ送ってください。辞めた人や漏れた場合は再発行すると古いリンクが無効になります
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {staffMembers?.map((staff) => {
          const token = tokens?.get(staff.id);
          return (
            <div key={staff.id} className="flex items-center justify-between gap-2 py-2">
              <span>{staff.username}</span>
              <div className="flex gap-2">
                {token ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => copy(token, staff.username)} className="gap-1">
                      <Copy className="h-4 w-4" />
                      コピー
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => issue(staff.id, staff.username)} className="gap-1">
                      <RefreshCw className="h-4 w-4" />
                      再発行
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => issue(staff.id, staff.username)}>
                    発行してコピー
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
