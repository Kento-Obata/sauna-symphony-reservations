import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkTaskDialog } from "./WorkTaskDialog";
import {
  CATEGORY_BADGE_CLASS,
  CATEGORY_LABELS,
  formatFrequency,
  formatLastWorked,
  isOverdue,
  type WorkCategory,
} from "../workUtils";

/** 作業場ごとの現状: 未完了タスクと、各項目の最終実施・目安超過 */
export const WorkStatusBoard = () => {
  const queryClient = useQueryClient();
  const [taskAreaId, setTaskAreaId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["work-status"],
    queryFn: async () => {
      const [areasRes, tasksRes, lastRes] = await Promise.all([
        supabase.from("work_areas").select("*, work_items(*)").eq("active", true).order("sort_order"),
        supabase
          .from("work_tasks")
          .select("*, assignee:profiles!work_tasks_assignee_id_fkey(username), creator:profiles!work_tasks_created_by_fkey(username)")
          .eq("status", "open")
          .order("created_at"),
        supabase.from("work_item_last_logs").select("*"),
      ]);
      if (areasRes.error) throw areasRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (lastRes.error) throw lastRes.error;

      const last = new Map<string, { worked_at: string; staff: string | null }>();
      for (const log of lastRes.data) {
        if (log.item_id && log.worked_at) {
          last.set(log.item_id, { worked_at: log.worked_at, staff: log.staff_name });
        }
      }
      return { areas: areasRes.data, tasks: tasksRes.data, last };
    },
    refetchInterval: 60_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["work-status"] });

  const cancelTask = async (id: string) => {
    const { error } = await supabase.from("work_tasks").update({ status: "cancelled" }).eq("id", id);
    if (error) {
      console.error("Error cancelling work task:", error);
      toast.error("更新に失敗しました");
      return;
    }
    toast.success("タスクを取り下げました");
    invalidate();
  };

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">読み込み中...</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.areas.map((area) => {
        const tasks = data.tasks.filter((t) => t.area_id === area.id);
        const items = area.work_items.filter((i) => i.active).sort((a, b) => a.sort_order - b.sort_order);
        return (
          <Card key={area.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                {area.name}
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => setTaskAreaId(area.id)}>
                  <PlusCircle className="h-4 w-4" />
                  タスク
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{task.title}</p>
                    {task.description && <p className="whitespace-pre-wrap text-muted-foreground">{task.description}</p>}
                    <p className="text-xs text-muted-foreground">
                      {task.creator?.username ?? "管理者"}が登録
                      {task.assignee ? ` / 担当 ${task.assignee.username}` : ""}
                      {task.due_date ? ` / ${task.due_date}まで` : ""} / {task.points}pt
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => cancelTask(task.id)}>
                    取り下げ
                  </Button>
                </div>
              ))}
              <div className="divide-y text-sm">
                {items.map((item) => {
                  const last = data.last.get(item.id) ?? null;
                  const overdue = isOverdue(item.frequency_days, last?.worked_at ?? null);
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="flex items-center gap-2">
                        {item.name}
                        {item.category !== "cleaning" && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] ${CATEGORY_BADGE_CLASS[item.category as WorkCategory]}`}>
                            {CATEGORY_LABELS[item.category as WorkCategory]}
                          </span>
                        )}
                      </span>
                      <span className={`text-right text-xs ${overdue ? "font-medium text-red-600" : "text-muted-foreground"}`}>
                        {overdue && "目安超過・"}
                        {formatLastWorked(last?.worked_at ?? null)}
                        {last?.staff ? `（${last.staff}）` : ""}
                        {formatFrequency(item.frequency_days) ? ` / ${formatFrequency(item.frequency_days)}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <WorkTaskDialog
        areaId={taskAreaId}
        items={data.areas.find((a) => a.id === taskAreaId)?.work_items ?? []}
        onClose={() => setTaskAreaId(null)}
        onCreated={() => {
          setTaskAreaId(null);
          invalidate();
        }}
      />
    </div>
  );
};
