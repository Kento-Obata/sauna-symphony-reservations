import { useEffect, useState } from "react";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadWorkPhotos } from "../photoUpload";
import type { RecordTarget } from "../staffWorkTypes";

interface RecordDialogProps {
  token: string;
  target: RecordTarget | null;
  onClose: () => void;
  /** 記録できたら獲得ポイント、すでに記録済みだった場合は null */
  onRecorded: (points: number | null) => void;
}

export const RecordDialog = ({ token, target, onClose, onRecorded }: RecordDialogProps) => {
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPhotos([]);
    setQuantity("");
    setNote("");
  }, [target]);

  useEffect(() => {
    const urls = photos.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);

  if (!target) return null;

  const item = target.item;
  const title = target.kind === "task" ? target.task.title : target.item.name;
  const points = target.kind === "task" ? target.task.points : target.item.points;
  const photoRequired = target.kind === "item" && target.item.photo_required;

  const handleSubmit = async () => {
    if (photoRequired && photos.length === 0) {
      toast.error("この作業は写真が必要です");
      return;
    }
    setSaving(true);
    try {
      const paths = photos.length > 0 ? await uploadWorkPhotos(token, photos) : [];
      const { data, error } = await supabase.rpc("staff_work_log_create", {
        p_token: token,
        p_area_id: target.areaId,
        p_item_id: target.kind === "item" ? target.item.id : null,
        p_task_id: target.kind === "task" ? target.task.id : null,
        p_title: null,
        p_quantity: quantity === "" ? null : Number(quantity),
        p_note: note || null,
        p_photo_paths: paths,
      });
      if (error) throw error;
      onRecorded((data as { points: number }).points);
    } catch (error) {
      console.error("Error recording work:", error);
      // 別の画面などからすでに記録していた場合
      if (error instanceof Object && "message" in error && error.message === "already_recorded") {
        toast.error("この作業は今日すでに記録済みです");
        onRecorded(null);
        return;
      }
      toast.error("記録できませんでした。電波の良いところでもう一度お試しください");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{points > 0 ? `記録すると +${points}pt` : "ポイントの付かない作業です"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {target.kind === "task" && target.task.description && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{target.task.description}</p>
          )}
          {target.kind === "item" && target.item.description && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{target.item.description}</p>
          )}

          <div className="space-y-2">
            <Label>写真{photoRequired ? "（必須）" : "（任意）"}</Label>
            <div className="flex flex-wrap gap-2">
              {previews.map((url, index) => (
                <div key={url} className="relative h-20 w-20 overflow-hidden rounded-md border">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                    onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                    aria-label="写真を外す"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground">
                <Camera className="h-5 w-5" />
                撮影・選択
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setPhotos((prev) => [...prev, ...files].slice(0, 4));
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {item?.quantity_label && (
            <div className="space-y-2">
              <Label htmlFor="record-quantity">
                {item.quantity_label}
                {item.quantity_unit ? `（${item.quantity_unit}）` : ""}
              </Label>
              <Input
                id="record-quantity"
                type="number"
                inputMode="numeric"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="record-note">メモ（任意）</Label>
            <Textarea
              id="record-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="気づいたこと・残りわずかな備品など"
            />
          </div>

          <Button className="h-12 w-full text-base" onClick={handleSubmit} disabled={saving}>
            {saving ? "記録中..." : "完了を記録する"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
