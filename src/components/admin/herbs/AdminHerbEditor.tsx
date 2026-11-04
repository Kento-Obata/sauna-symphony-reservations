import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHerbCatalog } from "@/hooks/useHerbCatalog";
import {
  HERB_NOTE_LABELS,
  HERB_NOTES,
  HERB_SAFETY_NOTE,
  HERB_TIERS,
  ORIGINAL_MAX_HERBS,
  findBlend,
  herbErrorMessage,
  herbInputFromReservation,
  herbTiersPayload,
  isHerbInputComplete,
  isTierComplete,
  recommendedTiers,
  type HerbChoice,
  type HerbInput,
  type HerbTierNumber,
} from "@/utils/herbs";
import { HerbSelectionAdminView } from "./HerbSelectionAdminView";

interface AdminHerbEditorProps {
  reservationId: string;
  choice: string | null | undefined;
  selection: unknown;
  updatedAt?: string | null;
  updatedBy?: string | null;
  onSaved?: () => void;
}

const NONE = "none";

/**
 * 管理画面・受付: 予約のハーブ蒸しを表示し、代理入力・変更する（締切なし）。
 * 「当日」の予約は、受付で決まった内容をそのまま入力できる
 */
export const AdminHerbEditor = ({ reservationId, choice, selection, updatedAt, updatedBy, onSaved }: AdminHerbEditorProps) => {
  const queryClient = useQueryClient();
  const { data: catalog } = useHerbCatalog();
  const [editing, setEditing] = useState(false);
  // 呼び出し元が持つ予約データは保存後すぐには更新されないため、保存した内容をここで表示する
  const [saved, setSaved] = useState({ choice, selection, updatedAt, updatedBy });
  const [value, setValue] = useState<HerbInput>(() => herbInputFromReservation(choice, selection));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSaved({ choice, selection, updatedAt, updatedBy });
  }, [reservationId, choice, selection, updatedAt, updatedBy]);

  useEffect(() => {
    if (!editing) setValue(herbInputFromReservation(saved.choice, saved.selection));
  }, [saved, editing]);

  const rec = recommendedTiers(catalog);
  // 当日の確定内容は「両段とも入力」か「未入力」のどちらか
  const consultTiersCount = HERB_TIERS.filter((t) => value.tiers[t].blend_id).length;
  const canSave =
    value.choice === "consult"
      ? consultTiersCount === 0 || HERB_TIERS.every((t) => isTierComplete(value.tiers[t], catalog))
      : value.choice === "recommended"
        ? !!rec?.available
        : isHerbInputComplete(value, catalog);

  const setTier = (tier: HerbTierNumber, blendId: string | null, herbIds: string[] = []) =>
    setValue({ ...value, tiers: { ...value.tiers, [tier]: { blend_id: blendId, herb_ids: herbIds } } });

  const toggleHerb = (tier: HerbTierNumber, herbId: string) => {
    const ids = value.tiers[tier].herb_ids;
    if (ids.includes(herbId)) setTier(tier, value.tiers[tier].blend_id, ids.filter((x) => x !== herbId));
    else if (ids.length < ORIGINAL_MAX_HERBS) setTier(tier, value.tiers[tier].blend_id, [...ids, herbId]);
  };

  const handleSave = async () => {
    setSaving(true);
    const { data, error } = await supabase.rpc("admin_set_reservation_herbs", {
      p_reservation_id: reservationId,
      p_choice: value.choice,
      p_tiers: herbTiersPayload(value, true),
    });
    setSaving(false);
    if (error) {
      console.error("Error saving reservation herbs:", error);
      toast.error(herbErrorMessage(error));
      return;
    }
    toast.success("ハーブ蒸しの内容を保存しました");
    setSaved({ choice: value.choice, selection: data, updatedAt: new Date().toISOString(), updatedBy: "staff" });
    setEditing(false);
    await queryClient.invalidateQueries({ queryKey: ["admin-reservations"] });
    await queryClient.invalidateQueries({ queryKey: ["herb-prep"] });
    onSaved?.();
  };

  if (!editing) {
    return (
      <div className="space-y-2">
        <HerbSelectionAdminView
          choice={saved.choice}
          selection={saved.selection}
          updatedAt={saved.updatedAt}
          updatedBy={saved.updatedBy}
        />
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          {saved.choice === "consult" && !saved.selection ? "受付で決まった内容を入力" : "ハーブを変更"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="space-y-1">
        <Label>選び方</Label>
        <Select value={value.choice} onValueChange={(v) => setValue({ ...value, choice: v as HerbChoice })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="select">事前に選ぶ</SelectItem>
            <SelectItem value="recommended" disabled={!rec?.available}>
              おすすめ{rec ? `（${rec.tier1.code} ＋ ${rec.tier2.code}）` : ""}
              {rec?.available ? "" : " ※在庫切れ"}
            </SelectItem>
            <SelectItem value="consult">当日スタッフと一緒に選ぶ</SelectItem>
          </SelectContent>
        </Select>
        {value.choice === "recommended" && rec && (
          <p className="text-xs text-muted-foreground">保存すると、今のおすすめ（{rec.tier1.code} {rec.tier1.title} ＋ {rec.tier2.code} {rec.tier2.title}）が記録されます</p>
        )}
      </div>

      {value.choice !== "recommended" && (
        <div className="space-y-3">
          {value.choice === "consult" && (
            <p className="text-xs text-muted-foreground">受付で決まったら両段を入力してください（未定なら空のまま）</p>
          )}
          {HERB_TIERS.map((tier) => {
            const blend = findBlend(catalog, value.tiers[tier].blend_id);
            return (
              <div key={tier} className="space-y-2">
                <Label>{tier}段目</Label>
                <Select
                  value={value.tiers[tier].blend_id ?? NONE}
                  onValueChange={(v) => setTier(tier, v === NONE ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>未選択</SelectItem>
                    {catalog?.blends.map((b) => (
                      <SelectItem key={b.id} value={b.id} disabled={!b.available}>
                        {b.code} {b.title}
                        {b.available ? "" : "（在庫切れ）"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {blend?.is_original && (
                  <div className="space-y-2 rounded-md bg-muted/50 p-2">
                    <p className="text-xs text-muted-foreground">
                      ハーブを{ORIGINAL_MAX_HERBS}種まで（{value.tiers[tier].herb_ids.length} / {ORIGINAL_MAX_HERBS}）
                    </p>
                    {HERB_NOTES.map((note) => (
                      <div key={note} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="w-16 text-xs text-muted-foreground">{HERB_NOTE_LABELS[note]}</span>
                        {catalog?.herbs
                          .filter((h) => h.note === note)
                          .map((h) => {
                            const checked = value.tiers[tier].herb_ids.includes(h.id);
                            const full = value.tiers[tier].herb_ids.length >= ORIGINAL_MAX_HERBS;
                            return (
                              <label key={h.id} className="flex items-center gap-1.5 text-sm">
                                <Checkbox
                                  checked={checked}
                                  disabled={!checked && full}
                                  onCheckedChange={() => toggleHerb(tier, h.id)}
                                />
                                {h.name}
                              </label>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{HERB_SAFETY_NOTE}</p>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
          キャンセル
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !canSave}>
          保存
        </Button>
      </div>
    </div>
  );
};
