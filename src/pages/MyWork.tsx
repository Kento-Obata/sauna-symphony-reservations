import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Camera, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScoreCard } from "@/components/work/staff/ScoreCard";
import { RecordDialog } from "@/components/work/staff/RecordDialog";
import { TaskCreateDialog } from "@/components/work/staff/TaskCreateDialog";
import { DoneItemDialog } from "@/components/work/staff/DoneItemDialog";
import type {
  RecordTarget,
  StaffWorkArea,
  StaffWorkItem,
  StaffWorkResponse,
} from "@/components/work/staffWorkTypes";
import {
  CATEGORY_BADGE_CLASS,
  CATEGORY_LABELS,
  formatClock,
  formatFrequency,
  formatLastWorked,
  isOverdue,
} from "@/components/work/workUtils";

/** 作業場ごとの「要対応」数（未完了タスク + 目安超過の項目） */
const attentionCount = (area: StaffWorkArea) =>
  area.tasks.length + area.items.filter((i) => isOverdue(i.frequency_days, i.last_worked_at)).length;

const MyWork = () => {
  const { token = "" } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [recordTarget, setRecordTarget] = useState<RecordTarget | null>(null);
  const [taskArea, setTaskArea] = useState<StaffWorkArea | null>(null);
  const [doneItem, setDoneItem] = useState<StaffWorkItem | null>(null);

  const queryKey = ["my-work", token];
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("staff_work_get", { p_token: token });
      if (error) throw error;
      return data as unknown as StaffWorkResponse;
    },
    retry: false,
    refetchInterval: 60_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const handleRecorded = (points: number | null) => {
    setRecordTarget(null);
    if (points !== null) {
      toast.success(points > 0 ? `+${points}pt 獲得！おつかれさまです` : "記録しました");
    }
    refresh();
  };

  const handleUndo = async (logId: string) => {
    setDoneItem(null);
    const { error } = await supabase.rpc("staff_work_log_delete", { p_token: token, p_log_id: logId });
    if (error) {
      console.error("Error deleting work log:", error);
      toast.error("取り消せませんでした");
      return;
    }
    toast.success("記録を取り消しました");
    refresh();
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
        このリンクは使えません。管理者に新しいリンクをもらってください
      </div>
    );
  }

  if (isLoading || !data) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">読み込み中...</div>;
  }

  const area = data.areas.find((a) => a.id === selectedAreaId) ?? data.areas[0];

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 px-4 pb-20 pt-6 text-zinc-900">
      <p className="mb-3 text-sm text-zinc-500">{data.staff.name}さん、おつかれさまです</p>
      <ScoreCard score={data.score} />

      {/* 作業場の切り替え */}
      <nav className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1">
        {data.areas.map((a) => {
          const count = attentionCount(a);
          const active = a.id === area?.id;
          return (
            <button
              key={a.id}
              onClick={() => setSelectedAreaId(a.id)}
              className={`relative shrink-0 rounded-full border px-4 py-2 text-sm ${
                active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white"
              }`}
            >
              {a.name}
              {count > 0 && (
                <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-xs text-white">{count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {area && (
        <main className="mt-4 space-y-6">
          {area.tasks.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-zinc-500">登録されたタスク</h2>
              {area.tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{task.title}</p>
                    {task.description && (
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-600">{task.description}</p>
                    )}
                    <p className="mt-1 text-xs text-zinc-500">
                      {task.created_by_name ? `${task.created_by_name}さんが登録` : "管理者が登録"}
                      {task.assignee_name ? ` / 担当 ${task.assignee_name}` : ""}
                      {task.due_date ? ` / ${task.due_date.slice(5).replace("-", "/")}まで` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0"
                    onClick={() =>
                      setRecordTarget({
                        kind: "task",
                        areaId: area.id,
                        task,
                        item: area.items.find((i) => i.id === task.item_id) ?? null,
                      })
                    }
                  >
                    完了 +{task.points}
                  </Button>
                </div>
              ))}
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-500">{area.name}の作業</h2>
            {area.items.length === 0 && <p className="text-sm text-zinc-500">作業項目はまだありません</p>}
            {area.items.map((item) => {
              const overdue = isOverdue(item.frequency_days, item.last_worked_at);
              // 1日1回の項目は、自分が今日記録したら完了。繰り返し項目は回数を出して何度でも記録できる
              const done = !item.repeatable && item.my_today_count > 0;
              return (
                <button
                  key={item.id}
                  onClick={() =>
                    done ? setDoneItem(item) : setRecordTarget({ kind: "item", areaId: area.id, item })
                  }
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left active:bg-zinc-100 ${
                    done ? "border-emerald-200 bg-emerald-50" : overdue ? "border-red-300 bg-white" : "border-zinc-200 bg-white"
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      done ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-400"
                    }`}
                  >
                    {done ? (
                      <Check className="h-5 w-5" />
                    ) : item.repeatable && item.my_today_count > 0 ? (
                      <span className="text-xs font-semibold text-zinc-700">{item.my_today_count}回</span>
                    ) : item.photo_required ? (
                      <Camera className="h-4 w-4" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{item.name}</span>
                      {item.category !== "cleaning" && (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] ${CATEGORY_BADGE_CLASS[item.category]}`}>
                          {CATEGORY_LABELS[item.category]}
                        </span>
                      )}
                    </div>
                    {done && item.my_today_log ? (
                      <p className="text-xs text-emerald-700">記録済み {formatClock(item.my_today_log.worked_at)}</p>
                    ) : (
                      <p className={`text-xs ${overdue ? "font-medium text-red-600" : "text-zinc-500"}`}>
                        {overdue && "目安超過・"}
                        最終 {formatLastWorked(item.last_worked_at)}
                        {item.last_staff_name ? `（${item.last_staff_name}）` : ""}
                        {formatFrequency(item.frequency_days) ? ` / ${formatFrequency(item.frequency_days)}` : ""}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 text-sm font-semibold ${done ? "text-emerald-600" : "text-sky-600"}`}>
                    +{item.points}
                  </span>
                </button>
              );
            })}
            <Button variant="outline" className="h-11 w-full gap-1 bg-white" onClick={() => setTaskArea(area)}>
              <Plus className="h-4 w-4" />
              {area.name}にタスクを登録
            </Button>
          </section>
        </main>
      )}

      <section className="mt-8 space-y-2">
        <h2 className="text-sm font-semibold text-zinc-500">今日の自分の記録</h2>
        {data.my_logs_today.length === 0 ? (
          <p className="text-sm text-zinc-500">まだありません</p>
        ) : (
          data.my_logs_today.map((log) => (
            <div key={log.id} className="flex items-center gap-3 rounded-lg bg-white p-3 text-sm">
              <span className="w-12 shrink-0 tabular-nums text-zinc-500">{formatClock(log.worked_at)}</span>
              <div className="min-w-0 flex-1">
                <p>
                  {log.area_name} / {log.title}
                </p>
                <p className="text-xs text-zinc-500">
                  {log.quantity !== null ? `${log.quantity}${log.quantity_unit ?? ""} ` : ""}
                  {log.photo_count > 0 ? `写真${log.photo_count}枚 ` : ""}
                  {log.note ?? ""}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-sky-600">+{log.points}</span>
              <button className="shrink-0 text-xs text-zinc-400 underline" onClick={() => handleUndo(log.id)}>
                取消
              </button>
            </div>
          ))
        )}
      </section>

      <RecordDialog
        token={token}
        target={recordTarget}
        onClose={() => setRecordTarget(null)}
        onRecorded={handleRecorded}
      />
      <DoneItemDialog item={doneItem} onClose={() => setDoneItem(null)} onUndo={handleUndo} />
      <TaskCreateDialog
        token={token}
        area={taskArea}
        onClose={() => setTaskArea(null)}
        onCreated={() => {
          setTaskArea(null);
          refresh();
        }}
      />
    </div>
  );
};

export default MyWork;
