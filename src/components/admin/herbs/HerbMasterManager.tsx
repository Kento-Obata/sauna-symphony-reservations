import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Pencil, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { HERB_NOTE_LABELS, HERB_NOTE_SHORT, HERB_NOTES, type HerbNote } from "@/utils/herbs";
import { HerbBlendDialog, type BlendWithHerbs } from "./HerbBlendDialog";

type Herb = Tables<"herbs">;
type Settings = Tables<"herb_settings">;

const NONE = "none";

/** DB の herb_blend_available() と同じ判定: 有効かつ構成ハーブがすべて有効 */
const isBlendAvailable = (blend: BlendWithHerbs, herbs: Herb[]) => {
  if (!blend.active) return false;
  const herbById = new Map(herbs.map((h) => [h.id, h]));
  if (blend.herb_blend_herbs.some((bh) => !herbById.get(bh.herb_id)?.active)) return false;
  return !blend.is_original || herbs.some((h) => h.active);
};

export const HerbMasterManager = () => {
  const queryClient = useQueryClient();
  const [editingBlend, setEditingBlend] = useState<BlendWithHerbs | "new" | null>(null);
  const [newHerbName, setNewHerbName] = useState("");
  const [newHerbNote, setNewHerbNote] = useState<HerbNote>("top");

  const { data } = useQuery({
    queryKey: ["herb-master"],
    queryFn: async () => {
      const [herbsRes, blendsRes, settingsRes, affectedRes] = await Promise.all([
        supabase.from("herbs").select("*").order("sort_order").order("name"),
        supabase.from("herb_blends").select("*, herb_blend_herbs(herb_id, sort_order)").order("sort_order").order("code"),
        supabase.from("herb_settings").select("*").single(),
        supabase.from("herb_affected_reservations").select("*").order("date").order("start_time"),
      ]);
      if (herbsRes.error) throw herbsRes.error;
      if (blendsRes.error) throw blendsRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (affectedRes.error) throw affectedRes.error;
      return {
        herbs: herbsRes.data,
        blends: blendsRes.data as BlendWithHerbs[],
        settings: settingsRes.data as Settings,
        affected: affectedRes.data,
      };
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["herb-master"] });
    queryClient.invalidateQueries({ queryKey: ["herb-catalog"] });
    queryClient.invalidateQueries({ queryKey: ["herb-prep"] });
  };

  if (!data) return <p className="text-sm text-muted-foreground">読み込み中...</p>;
  const { herbs, blends, settings, affected } = data;
  const herbName = (id: string) => herbs.find((h) => h.id === id);

  const recTier1 = blends.find((b) => b.id === settings.recommended_tier1_blend_id);
  const recTier2 = blends.find((b) => b.id === settings.recommended_tier2_blend_id);
  const recProblems = [
    !recTier1 && "1段目が未設定です",
    !recTier2 && "2段目が未設定です",
    ...[recTier1, recTier2].flatMap((b, i) =>
      b && !isBlendAvailable(b, herbs) ? [`${i + 1}段目の ${b.code} ${b.title} が無効か、在庫切れのハーブを含んでいます`] : []
    ),
  ].filter(Boolean) as string[];

  const updateHerb = async (id: string, fields: Partial<Herb>) => {
    const { error } = await supabase
      .from("herbs")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("Error updating herb:", error);
      toast.error("ハーブの更新に失敗しました");
      return;
    }
    invalidate();
  };

  const addHerb = async () => {
    if (!newHerbName.trim()) return;
    const nextOrder = herbs.filter((h) => h.note === newHerbNote).reduce((max, h) => Math.max(max, h.sort_order), 0) + 1;
    const { error } = await supabase.from("herbs").insert({ name: newHerbName.trim(), note: newHerbNote, sort_order: nextOrder });
    if (error) {
      console.error("Error creating herb:", error);
      toast.error("ハーブの追加に失敗しました");
      return;
    }
    setNewHerbName("");
    invalidate();
  };

  const updateBlendActive = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from("herb_blends")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("Error updating blend:", error);
      toast.error("ブレンドの更新に失敗しました");
      return;
    }
    invalidate();
  };

  const updateRecommended = async (tier: 1 | 2, blendId: string) => {
    const column = tier === 1 ? "recommended_tier1_blend_id" : "recommended_tier2_blend_id";
    const { error } = await supabase
      .from("herb_settings")
      .update({ [column]: blendId === NONE ? null : blendId, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) {
      console.error("Error updating herb settings:", error);
      toast.error("おすすめの更新に失敗しました");
      return;
    }
    toast.success("おすすめを更新しました（既存の予約の内容は変わりません）");
    invalidate();
  };

  return (
    <div className="space-y-6">
      {recProblems.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>おすすめが選べない状態です</AlertTitle>
          <AlertDescription>
            {recProblems.join("／")}。予約画面では「おすすめ」を選べず、既定が「当日スタッフと一緒に選ぶ」になります
          </AlertDescription>
        </Alert>
      )}

      {affected.length > 0 && (
        <Card className="border-red-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-700">
              <AlertTriangle className="h-4 w-4" />
              在庫切れ・無効なブレンドを含む予約（{new Set(affected.map((a) => a.id)).size}件）
            </CardTitle>
            <CardDescription>お客様へご連絡のうえ、予約詳細または仕込みリストから内容を変更してください</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日時</TableHead>
                  <TableHead>お客様</TableHead>
                  <TableHead>電話番号</TableHead>
                  <TableHead>該当</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affected.map((a) => (
                  <TableRow key={`${a.id}-${a.tier}`}>
                    <TableCell>
                      {a.date} {a.start_time?.slice(0, 5)}
                    </TableCell>
                    <TableCell>
                      {a.guest_name}様（R-{a.reservation_code}）
                    </TableCell>
                    <TableCell>{a.phone}</TableCell>
                    <TableCell>
                      {a.tier}段目 {a.blend_code} {a.blend_title}
                      {a.blend_inactive ? "（ブレンド無効）" : ""}
                      {a.unavailable_herbs ? `（在庫切れ: ${a.unavailable_herbs}）` : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">おすすめ</CardTitle>
          <CardDescription>予約画面の「おすすめ」の中身です。変えても、すでに予約済みの内容は変わりません</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {([1, 2] as const).map((tier) => {
            const current = tier === 1 ? recTier1 : recTier2;
            return (
              <div key={tier} className="space-y-1">
                <span className="text-sm">{tier}段目</span>
                <Select value={current?.id ?? NONE} onValueChange={(v) => updateRecommended(tier, v)}>
                  <SelectTrigger className={cn(current && !isBlendAvailable(current, herbs) && "border-red-400")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>未設定</SelectItem>
                    {blends
                      .filter((b) => !b.is_original)
                      .map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.code} {b.title}
                          {isBlendAvailable(b, herbs) ? "" : "（選べない状態）"}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ハーブ</CardTitle>
          <CardDescription>
            在庫切れのときはオフにしてください。そのハーブを使うブレンドは予約画面で自動的に選べなくなり、ORIGINALの選択肢からも外れます
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {HERB_NOTES.map((note) => (
            <div key={note}>
              <p className="mb-1 text-xs text-muted-foreground">{HERB_NOTE_LABELS[note]}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {herbs
                  .filter((h) => h.note === note)
                  .map((h) => (
                    <div key={h.id} className={cn("flex items-center gap-2 rounded-md border px-3 py-2", !h.active && "opacity-60")}>
                      <Input
                        defaultValue={h.name}
                        onBlur={(e) => e.target.value.trim() && e.target.value !== h.name && updateHerb(h.id, { name: e.target.value.trim() })}
                        className="h-8"
                        aria-label="ハーブの名前"
                      />
                      <label className="flex shrink-0 items-center gap-1.5 text-xs">
                        <Switch checked={h.active} onCheckedChange={(active) => updateHerb(h.id, { active })} />
                        {h.active ? "在庫あり" : "在庫切れ"}
                      </label>
                    </div>
                  ))}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Input
              value={newHerbName}
              onChange={(e) => setNewHerbName(e.target.value)}
              placeholder="新しいハーブ"
              className="w-48"
            />
            <Select value={newHerbNote} onValueChange={(v) => setNewHerbNote(v as HerbNote)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HERB_NOTES.map((n) => (
                  <SelectItem key={n} value={n}>
                    {HERB_NOTE_LABELS[n]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={addHerb} disabled={!newHerbName.trim()}>
              ハーブを追加
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">ブレンド</CardTitle>
            <CardDescription className="mt-1.5">編集しても、すでに予約済みの内容は変わりません</CardDescription>
          </div>
          <Button size="sm" className="gap-1" onClick={() => setEditingBlend("new")}>
            <PlusCircle className="h-4 w-4" />
            ブレンドを追加
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {blends.map((b) => {
            const available = isBlendAvailable(b, herbs);
            return (
              <div key={b.id} className={cn("flex flex-wrap items-start gap-3 rounded-md border p-3", !b.active && "opacity-60")}>
                <span className="w-8 font-mono text-lg text-muted-foreground">{b.code}</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{b.title}</span>
                    {b.needs_prep && <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">仕込み</Badge>}
                    {b.is_original && <Badge variant="outline">ハーブを選ぶ</Badge>}
                    {b.active && !available && <Badge variant="destructive">在庫切れのハーブあり</Badge>}
                  </div>
                  {!b.is_original && (
                    <p className="text-xs text-muted-foreground">
                      {[...b.herb_blend_herbs]
                        .sort((x, y) => x.sort_order - y.sort_order)
                        .map((bh) => {
                          const h = herbName(bh.herb_id);
                          return h ? `${HERB_NOTE_SHORT[h.note as HerbNote]} ${h.name}${h.active ? "" : "（在庫切れ）"}` : "";
                        })
                        .join(" / ")}
                    </p>
                  )}
                  {b.description && <p className="whitespace-pre-line text-xs text-muted-foreground">{b.description}</p>}
                  {b.caution && <p className="text-xs text-amber-800">※{b.caution}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs">
                    <Switch checked={b.active} onCheckedChange={(active) => updateBlendActive(b.id, active)} />
                    {b.active ? "有効" : "無効"}
                  </label>
                  <Button variant="ghost" size="icon" onClick={() => setEditingBlend(b)} aria-label="編集">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <HerbBlendDialog
        target={editingBlend}
        herbs={herbs}
        nextSortOrder={blends.reduce((max, b) => Math.max(max, b.sort_order), 0) + 1}
        onClose={() => setEditingBlend(null)}
        onSaved={() => {
          setEditingBlend(null);
          invalidate();
        }}
      />
    </div>
  );
};
