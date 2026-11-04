import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  CATEGORY_BADGE_CLASS,
  CATEGORY_LABELS,
  WORK_PHOTO_BUCKET,
  formatDateTime,
  todayJst,
  type WorkCategory,
} from "../workUtils";

type GroupBy = "staff" | "area";

const monthStart = () => `${todayJst().slice(0, 7)}-01`;

export const WorkLogs = () => {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayJst);
  const [groupBy, setGroupBy] = useState<GroupBy>("staff");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const queryKey = ["work-logs", from, to];
  const { data: logs, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_logs")
        .select("*, staff:profiles!work_logs_staff_id_fkey(username), area:work_areas(name), work_log_photos(storage_path)")
        .gte("work_date", from)
        .lte("work_date", to)
        .order("worked_at", { ascending: false });
      if (error) throw error;

      // 写真は非公開バケットなので、表示用に期限付き URL を発行する
      const paths = data.flatMap((log) => log.work_log_photos.map((p) => p.storage_path));
      const urls = new Map<string, string>();
      if (paths.length > 0) {
        const { data: signed, error: signError } = await supabase.storage
          .from(WORK_PHOTO_BUCKET)
          .createSignedUrls(paths, 60 * 60);
        if (signError) throw signError;
        signed.forEach((s) => s.path && s.signedUrl && urls.set(s.path, s.signedUrl));
      }
      return data.map((log) => ({
        ...log,
        photoUrls: log.work_log_photos.map((p) => urls.get(p.storage_path)).filter((u): u is string => !!u),
      }));
    },
  });

  const groups = useMemo(() => {
    const map = new Map<string, NonNullable<typeof logs>>();
    for (const log of logs ?? []) {
      const key = (groupBy === "staff" ? log.staff?.username : log.area?.name) ?? "不明";
      map.set(key, [...(map.get(key) ?? []), log]);
    }
    return Array.from(map, ([name, items]) => {
      const quantities = new Map<string, number>();
      for (const l of items) {
        if (l.quantity !== null) {
          const label = `${l.title}${l.quantity_unit ? `(${l.quantity_unit})` : ""}`;
          quantities.set(label, (quantities.get(label) ?? 0) + Number(l.quantity));
        }
      }
      return {
        name,
        items,
        points: items.reduce((sum, l) => sum + (l.rejected ? 0 : l.points), 0),
        quantities: Array.from(quantities),
      };
    }).sort((a, b) => b.items.length - a.items.length);
  }, [logs, groupBy]);

  const setRejected = async (id: string, rejected: boolean) => {
    const { error } = await supabase.from("work_logs").update({ rejected }).eq("id", id);
    if (error) {
      console.error("Error updating work log:", error);
      toast.error("更新に失敗しました");
      return;
    }
    queryClient.invalidateQueries({ queryKey });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="log-from">期間</Label>
          <div className="flex items-center gap-2">
            <Input id="log-from" type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-40" />
            〜
            <Input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-40" />
          </div>
        </div>
        <ToggleGroup type="single" value={groupBy} onValueChange={(v) => v && setGroupBy(v as GroupBy)}>
          <ToggleGroupItem value="staff" variant="outline">
            スタッフ別
          </ToggleGroupItem>
          <ToggleGroupItem value="area" variant="outline">
            作業場別
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">この期間の記録はありません</p>
      ) : (
        groups.map((group) => (
          <Card key={group.name}>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-baseline justify-between gap-2 text-base">
                <span>{group.name}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {group.items.length}件 / {group.points}pt
                  {group.quantities.map(([label, total]) => ` / ${label} ${total}`).join("")}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {group.items.map((log) => (
                <div key={log.id} className={`flex flex-wrap items-start gap-3 py-2 ${log.rejected ? "opacity-50" : ""}`}>
                  <span className="w-28 shrink-0 text-sm tabular-nums text-muted-foreground">
                    {formatDateTime(log.worked_at)}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${CATEGORY_BADGE_CLASS[log.category as WorkCategory]}`}>
                        {CATEGORY_LABELS[log.category as WorkCategory]}
                      </span>
                      <span className="font-medium">
                        {groupBy === "staff" ? log.area?.name : log.staff?.username} / {log.title}
                      </span>
                      {log.task_id && <span className="text-xs text-amber-700">タスク完了</span>}
                      {log.quantity !== null && (
                        <span>
                          {log.quantity}
                          {log.quantity_unit}
                        </span>
                      )}
                    </div>
                    {log.note && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{log.note}</p>}
                    {log.photoUrls.length > 0 && (
                      <div className="flex gap-2">
                        {log.photoUrls.map((url) => (
                          <button key={url} onClick={() => setPhotoUrl(url)} className="h-16 w-16 overflow-hidden rounded border">
                            <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums">{log.rejected ? 0 : log.points}pt</span>
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Switch checked={log.rejected} onCheckedChange={(checked) => setRejected(log.id, checked)} />
                      否認
                    </label>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={!!photoUrl} onOpenChange={(open) => !open && setPhotoUrl(null)}>
        <DialogContent className="max-w-3xl p-2">{photoUrl && <img src={photoUrl} alt="" className="w-full rounded" />}</DialogContent>
      </Dialog>
    </div>
  );
};
