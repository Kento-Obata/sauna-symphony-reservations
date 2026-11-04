import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStaffMembers } from "@/hooks/useStaffMembers";
import { CATEGORY_LABELS, type WorkCategory } from "../workUtils";

const NONE = "none";

interface WorkTaskDialogProps {
  areaId: string | null;
  items: Tables<"work_items">[];
  onClose: () => void;
  onCreated: () => void;
}

/** 管理者が作業場にタスクを登録する（担当・期限・ポイントを指定できる） */
export const WorkTaskDialog = ({ areaId, items, onClose, onCreated }: WorkTaskDialogProps) => {
  const { data: staffMembers } = useStaffMembers();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<WorkCategory>("cleaning");
  const [itemId, setItemId] = useState(NONE);
  const [assigneeId, setAssigneeId] = useState(NONE);
  const [dueDate, setDueDate] = useState("");
  const [points, setPoints] = useState("1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle("");
    setDescription("");
    setCategory("cleaning");
    setItemId(NONE);
    setAssigneeId(NONE);
    setDueDate("");
    setPoints("1");
  }, [areaId]);

  if (!areaId) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("内容を入力してください");
      return;
    }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("work_tasks").insert({
      area_id: areaId,
      item_id: itemId === NONE ? null : itemId,
      title: title.trim(),
      description: description.trim() || null,
      category,
      assignee_id: assigneeId === NONE ? null : assigneeId,
      due_date: dueDate || null,
      points: Math.max(0, parseInt(points) || 0),
      created_by: session?.user.id ?? null,
    });
    setSaving(false);
    if (error) {
      console.error("Error creating work task:", error);
      toast.error("登録に失敗しました");
      return;
    }
    toast.success("タスクを登録しました");
    onCreated();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>タスクを登録</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="work-task-title">内容</Label>
            <Input id="work-task-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="work-task-description">詳しく（任意）</Label>
            <Textarea id="work-task-description" value={description} onChange={(e) => setDescription(e.target.value)} />
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
              <Label>関連する作業項目</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>なし</SelectItem>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>担当</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>誰でも</SelectItem>
                  {staffMembers?.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="work-task-due">期限（任意）</Label>
              <Input id="work-task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="work-task-points">ポイント</Label>
              <Input id="work-task-points" type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            登録
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
