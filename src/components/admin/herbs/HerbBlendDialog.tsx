import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { HERB_NOTE_LABELS, HERB_NOTES, type HerbNote } from "@/utils/herbs";

export type BlendWithHerbs = Tables<"herb_blends"> & {
  herb_blend_herbs: { herb_id: string; sort_order: number }[];
};

interface HerbBlendDialogProps {
  /** 編集するブレンド。"new" で追加 */
  target: BlendWithHerbs | "new" | null;
  herbs: Tables<"herbs">[];
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}

export const HerbBlendDialog = ({ target, herbs, nextSortOrder, onClose, onSaved }: HerbBlendDialogProps) => {
  const blend = target && target !== "new" ? target : null;
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [caution, setCaution] = useState("");
  const [isOriginal, setIsOriginal] = useState(false);
  const [needsPrep, setNeedsPrep] = useState(false);
  const [sortOrder, setSortOrder] = useState("");
  // 構成ハーブ（選んだ順 = 表示順）
  const [herbIds, setHerbIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setCode(blend?.code ?? "");
    setTitle(blend?.title ?? "");
    setDescription(blend?.description ?? "");
    setCaution(blend?.caution ?? "");
    setIsOriginal(blend?.is_original ?? false);
    setNeedsPrep(blend?.needs_prep ?? false);
    setSortOrder(String(blend?.sort_order ?? nextSortOrder));
    setHerbIds(
      [...(blend?.herb_blend_herbs ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((bh) => bh.herb_id)
    );
  }, [target, blend, nextSortOrder]);

  if (!target) return null;

  const toggleHerb = (id: string) =>
    setHerbIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSave = async () => {
    if (!code.trim() || !title.trim()) {
      toast.error("番号と見出しを入力してください");
      return;
    }
    if (!isOriginal && herbIds.length === 0) {
      toast.error("構成ハーブを1つ以上選んでください");
      return;
    }
    setSaving(true);
    try {
      const fields = {
        code: code.trim(),
        title: title.trim(),
        description: description.trim() || null,
        caution: caution.trim() || null,
        is_original: isOriginal,
        needs_prep: needsPrep,
        sort_order: parseInt(sortOrder) || nextSortOrder,
        updated_at: new Date().toISOString(),
      };
      let blendId = blend?.id;
      if (blendId) {
        const { error } = await supabase.from("herb_blends").update(fields).eq("id", blendId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("herb_blends").insert(fields).select("id").single();
        if (error) throw error;
        blendId = data.id;
      }

      // 構成は入れ替える（予約には予約時点の内容が保存されているので、過去の予約には影響しない）
      const { error: deleteError } = await supabase.from("herb_blend_herbs").delete().eq("blend_id", blendId);
      if (deleteError) throw deleteError;
      if (!isOriginal && herbIds.length > 0) {
        const { error: insertError } = await supabase
          .from("herb_blend_herbs")
          .insert(herbIds.map((herbId, index) => ({ blend_id: blendId!, herb_id: herbId, sort_order: index + 1 })));
        if (insertError) throw insertError;
      }

      toast.success("ブレンドを保存しました");
      onSaved();
    } catch (error) {
      console.error("Error saving herb blend:", error);
      const duplicated = error instanceof Object && "code" in error && error.code === "23505";
      toast.error(duplicated ? "同じ番号のブレンドがあります" : "ブレンドの保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{blend ? "ブレンドを編集" : "ブレンドを追加"}</DialogTitle>
          <DialogDescription>変更は今後の予約から反映されます。すでに予約済みの内容は変わりません</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-[6rem_1fr_5rem] gap-3">
            <div className="space-y-1">
              <Label htmlFor="blend-code">番号</Label>
              <Input id="blend-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="08" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="blend-title">見出し</Label>
              <Input id="blend-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="blend-order">表示順</Label>
              <Input id="blend-order" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="blend-description">説明文（文末の句点は付けず、区切りは改行）</Label>
            <Textarea id="blend-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="blend-caution">注意書き（任意）</Label>
            <Input
              id="blend-caution"
              value={caution}
              onChange={(e) => setCaution(e.target.value)}
              placeholder="例: 作成にお時間をいただきます"
            />
          </div>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>
              仕込みに手間がかかる
              <span className="block text-xs text-muted-foreground">仕込みリスト・スタッフLINEで目立たせます</span>
            </span>
            <Switch checked={needsPrep} onCheckedChange={setNeedsPrep} />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>
              お客様がハーブを選ぶ（ORIGINAL）
              <span className="block text-xs text-muted-foreground">構成を持たず、有効なハーブから1〜3種を選んでもらいます</span>
            </span>
            <Switch checked={isOriginal} onCheckedChange={setIsOriginal} />
          </label>

          {!isOriginal && (
            <div className="space-y-2">
              <Label>構成ハーブ（選んだ順に表示）</Label>
              {HERB_NOTES.map((note) => (
                <div key={note} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="w-16 text-xs text-muted-foreground">{HERB_NOTE_LABELS[note]}</span>
                  {herbs
                    .filter((h) => (h.note as HerbNote) === note)
                    .map((h) => (
                      <label key={h.id} className="flex items-center gap-1.5 text-sm">
                        <Checkbox checked={herbIds.includes(h.id)} onCheckedChange={() => toggleHerb(h.id)} />
                        {h.name}
                        {herbIds.includes(h.id) && (
                          <span className="text-xs text-muted-foreground">({herbIds.indexOf(h.id) + 1})</span>
                        )}
                      </label>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
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
