import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_LABELS, type WorkCategory } from "../workUtils";

interface WorkItemDialogProps {
  /** 編集時は item、追加時は areaId だけ渡す */
  target: { areaId: string; item: Tables<"work_items"> | null; nextSortOrder: number } | null;
  onClose: () => void;
  onSaved: () => void;
}

export const WorkItemDialog = ({ target, onClose, onSaved }: WorkItemDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<WorkCategory>("cleaning");
  const [frequencyDays, setFrequencyDays] = useState("");
  const [points, setPoints] = useState("1");
  const [repeatable, setRepeatable] = useState(false);
  const [photoRequired, setPhotoRequired] = useState(false);
  const [quantityLabel, setQuantityLabel] = useState("");
  const [quantityUnit, setQuantityUnit] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const item = target?.item;
    setName(item?.name ?? "");
    setDescription(item?.description ?? "");
    setCategory((item?.category as WorkCategory) ?? "cleaning");
    setFrequencyDays(item?.frequency_days ? String(item.frequency_days) : "");
    setPoints(String(item?.points ?? 1));
    setRepeatable(item?.repeatable ?? false);
    setPhotoRequired(item?.photo_required ?? false);
    setQuantityLabel(item?.quantity_label ?? "");
    setQuantityUnit(item?.quantity_unit ?? "");
  }, [target]);

  if (!target) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("作業名を入力してください");
      return;
    }
    setSaving(true);
    const fields = {
      name: name.trim(),
      description: description.trim() || null,
      category,
      frequency_days: frequencyDays ? Math.max(1, parseInt(frequencyDays)) : null,
      points: Math.max(0, parseInt(points) || 0),
      repeatable,
      photo_required: photoRequired,
      quantity_label: quantityLabel.trim() || null,
      quantity_unit: quantityUnit.trim() || null,
    };
    const { error } = target.item
      ? await supabase.from("work_items").update(fields).eq("id", target.item.id)
      : await supabase
          .from("work_items")
          .insert({ ...fields, area_id: target.areaId, sort_order: target.nextSortOrder });
    setSaving(false);
    if (error) {
      console.error("Error saving work item:", error);
      toast.error("保存に失敗しました");
      return;
    }
    toast.success("作業項目を保存しました");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{target.item ? "作業項目を編集" : "作業項目を追加"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item-name">作業名</Label>
            <Input id="item-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-description">手順・注意点（任意。スタッフの記録画面に出ます）</Label>
            <Textarea id="item-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>種類</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as WorkCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-frequency">頻度の目安（日ごと・任意）</Label>
              <Input
                id="item-frequency"
                type="number"
                min={1}
                value={frequencyDays}
                onChange={(e) => setFrequencyDays(e.target.value)}
                placeholder="例: 1 = 毎日 / 7 = 週1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-points">ポイント</Label>
              <Input id="item-points" type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-quantity-label">数量の入力（任意）</Label>
              <div className="flex gap-2">
                <Input
                  id="item-quantity-label"
                  value={quantityLabel}
                  onChange={(e) => setQuantityLabel(e.target.value)}
                  placeholder="例: 畳んだ量"
                />
                <Input
                  value={quantityUnit}
                  onChange={(e) => setQuantityUnit(e.target.value)}
                  placeholder="単位"
                  className="w-20"
                  aria-label="単位"
                />
              </div>
            </div>
          </div>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>
              写真を必須にする
              <span className="block text-xs text-muted-foreground">仕上がり確認が必要な作業向け</span>
            </span>
            <Switch checked={photoRequired} onCheckedChange={setPhotoRequired} />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>
              1日に何度でも加点する
              <span className="block text-xs text-muted-foreground">オフにすると、その日最初の記録だけにポイントが付きます</span>
            </span>
            <Switch checked={repeatable} onCheckedChange={setRepeatable} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
