import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { StaffWorkArea } from "../staffWorkTypes";
import { CATEGORY_LABELS, type WorkCategory } from "../workUtils";

interface TaskCreateDialogProps {
  token: string;
  area: StaffWorkArea | null;
  onClose: () => void;
  onCreated: () => void;
}

/** 作業場にタスクを登録する（不具合・後でやること・頼みたいこと） */
export const TaskCreateDialog = ({ token, area, onClose, onCreated }: TaskCreateDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<WorkCategory>("cleaning");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle("");
    setDescription("");
    setCategory("cleaning");
  }, [area]);

  if (!area) return null;

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("内容を入力してください");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("staff_work_task_create", {
      p_token: token,
      p_area_id: area.id,
      p_item_id: null,
      p_title: title,
      p_description: description || null,
      p_category: category,
    });
    setSaving(false);
    if (error) {
      console.error("Error creating work task:", error);
      toast.error("登録できませんでした");
      return;
    }
    toast.success("タスクを登録しました");
    onCreated();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{area.name}にタスクを登録</DialogTitle>
          <DialogDescription>壊れている・汚れが落ちない・後でやることなど。誰かが完了を記録するまで残ります</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">内容</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: シャワー室2の排水が遅い"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-description">詳しく（任意）</Label>
            <Textarea id="task-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>種類</Label>
            <ToggleGroup
              type="single"
              value={category}
              onValueChange={(v) => v && setCategory(v as WorkCategory)}
              className="justify-start"
            >
              {(["cleaning", "maintenance"] as const).map((c) => (
                <ToggleGroupItem key={c} value={c} variant="outline">
                  {CATEGORY_LABELS[c]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <Button className="h-12 w-full text-base" onClick={handleSubmit} disabled={saving}>
            登録する
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
