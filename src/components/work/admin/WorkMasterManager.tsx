import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { WorkItemDialog } from "./WorkItemDialog";
import { CATEGORY_BADGE_CLASS, CATEGORY_LABELS, formatFrequency, type WorkCategory } from "../workUtils";

type AreaWithItems = Tables<"work_areas"> & { work_items: Tables<"work_items">[] };

/** 並び順を入れ替えて sort_order を振り直す */
const swapOrder = async (table: "work_areas" | "work_items", rows: { id: string }[], index: number, delta: number) => {
  const target = index + delta;
  if (target < 0 || target >= rows.length) return;
  const reordered = [...rows];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  const results = await Promise.all(
    reordered.map((row, i) => supabase.from(table).update({ sort_order: i + 1 }).eq("id", row.id))
  );
  if (results.some((r) => r.error)) toast.error("並び替えに失敗しました");
};

export const WorkMasterManager = () => {
  const queryClient = useQueryClient();
  const [newAreaName, setNewAreaName] = useState("");
  const [itemTarget, setItemTarget] = useState<{
    areaId: string;
    item: Tables<"work_items"> | null;
    nextSortOrder: number;
  } | null>(null);

  const { data: areas } = useQuery({
    queryKey: ["work-master"],
    queryFn: async () => {
      const { data, error } = await supabase.from("work_areas").select("*, work_items(*)").order("sort_order");
      if (error) throw error;
      return (data as AreaWithItems[]).map((area) => ({
        ...area,
        work_items: [...area.work_items].sort((a, b) => a.sort_order - b.sort_order),
      }));
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["work-master"] });
    queryClient.invalidateQueries({ queryKey: ["work-status"] });
  };

  const addArea = async () => {
    if (!newAreaName.trim()) return;
    const nextOrder = (areas?.reduce((max, a) => Math.max(max, a.sort_order), 0) ?? 0) + 1;
    const { error } = await supabase.from("work_areas").insert({ name: newAreaName.trim(), sort_order: nextOrder });
    if (error) {
      console.error("Error creating work area:", error);
      toast.error("追加に失敗しました");
      return;
    }
    setNewAreaName("");
    invalidate();
  };

  const updateArea = async (id: string, fields: Partial<Tables<"work_areas">>) => {
    const { error } = await supabase.from("work_areas").update(fields).eq("id", id);
    if (error) {
      console.error("Error updating work area:", error);
      toast.error("更新に失敗しました");
      return;
    }
    invalidate();
  };

  const toggleItem = async (id: string, active: boolean) => {
    const { error } = await supabase.from("work_items").update({ active }).eq("id", id);
    if (error) {
      console.error("Error updating work item:", error);
      toast.error("更新に失敗しました");
      return;
    }
    invalidate();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        作業項目は削除せず「使う」をオフにしてください（過去のログはそのまま残ります）。営業系の作業は記録の手間を考えて、必要なものだけ登録するのがおすすめです
      </p>

      {areas?.map((area, areaIndex) => (
        <Card key={area.id} className={area.active ? "" : "opacity-60"}>
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
              <Input
                defaultValue={area.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== area.name && updateArea(area.id, { name: e.target.value.trim() })}
                className="h-8 w-48 font-semibold"
                aria-label="作業場の名前"
              />
              <div className="flex items-center gap-1">
                <label className="mr-2 flex items-center gap-2 text-sm font-normal">
                  <Switch checked={area.active} onCheckedChange={(active) => updateArea(area.id, { active })} />
                  {area.active ? "使う" : "停止中"}
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={areaIndex === 0}
                  onClick={async () => {
                    await swapOrder("work_areas", areas, areaIndex, -1);
                    invalidate();
                  }}
                  aria-label="上へ"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={areaIndex === areas.length - 1}
                  onClick={async () => {
                    await swapOrder("work_areas", areas, areaIndex, 1);
                    invalidate();
                  }}
                  aria-label="下へ"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {area.work_items.map((item, itemIndex) => (
              <div key={item.id} className={`flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm ${item.active ? "" : "opacity-50"}`}>
                <span className="font-medium">{item.name}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${CATEGORY_BADGE_CLASS[item.category as WorkCategory]}`}>
                  {CATEGORY_LABELS[item.category as WorkCategory]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.points}pt
                  {item.repeatable ? "（何度でも）" : ""}
                  {formatFrequency(item.frequency_days) ? ` / ${formatFrequency(item.frequency_days)}` : ""}
                  {item.photo_required ? " / 写真必須" : ""}
                  {item.quantity_label ? ` / ${item.quantity_label}${item.quantity_unit ? `(${item.quantity_unit})` : ""}` : ""}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <label className="mr-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Switch checked={item.active} onCheckedChange={(active) => toggleItem(item.id, active)} />
                    使う
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={itemIndex === 0}
                    onClick={async () => {
                      await swapOrder("work_items", area.work_items, itemIndex, -1);
                      invalidate();
                    }}
                    aria-label="上へ"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={itemIndex === area.work_items.length - 1}
                    onClick={async () => {
                      await swapOrder("work_items", area.work_items, itemIndex, 1);
                      invalidate();
                    }}
                    aria-label="下へ"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setItemTarget({ areaId: area.id, item, nextSortOrder: 0 })}
                    aria-label="編集"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() =>
                setItemTarget({
                  areaId: area.id,
                  item: null,
                  nextSortOrder: area.work_items.reduce((max, i) => Math.max(max, i.sort_order), 0) + 1,
                })
              }
            >
              <PlusCircle className="h-4 w-4" />
              作業項目を追加
            </Button>
          </CardContent>
        </Card>
      ))}

      <div className="flex gap-2">
        <Input
          value={newAreaName}
          onChange={(e) => setNewAreaName(e.target.value)}
          placeholder="新しい作業場（例: 民泊A棟）"
          className="w-64"
        />
        <Button onClick={addArea} disabled={!newAreaName.trim()}>
          作業場を追加
        </Button>
      </div>

      <WorkItemDialog
        target={itemTarget}
        onClose={() => setItemTarget(null)}
        onSaved={() => {
          setItemTarget(null);
          invalidate();
        }}
      />
    </div>
  );
};
