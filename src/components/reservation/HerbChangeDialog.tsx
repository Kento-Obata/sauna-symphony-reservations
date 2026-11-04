import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HerbPicker } from "@/components/site/booking/HerbPicker";
import { useHerbCatalog } from "@/hooks/useHerbCatalog";
import type { Reservation } from "@/types/reservation";
import { herbInputFromReservation, herbTiersPayload, isHerbInputComplete, type HerbInput } from "@/utils/herbs";

interface HerbChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation;
  /** 本人確認。予約リンクのトークン、または入力済みの電話番号下4桁 */
  accessToken?: string;
  phoneLastFourDigits?: string;
  onSaved: (herb: { herb_choice: string; herb_selection: unknown }) => void;
}

/** 非2xx のときは Edge Function のエラーメッセージを取り出す */
const extractServerMessage = async (error: unknown): Promise<string | null> => {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === "string") return body.error;
    } catch {
      // JSON でないレスポンスは無視
    }
  }
  return null;
};

/** マイページ: ハーブ蒸しの選び方・ブレンドの変更（前日24時まで） */
export const HerbChangeDialog = ({
  open,
  onOpenChange,
  reservation,
  accessToken,
  phoneLastFourDigits,
  onSaved,
}: HerbChangeDialogProps) => {
  const { data: catalog, isLoading, isError } = useHerbCatalog();
  const [value, setValue] = useState<HerbInput>(() =>
    herbInputFromReservation(reservation.herb_choice, reservation.herb_selection)
  );
  const [saving, setSaving] = useState(false);

  // 開くたびに保存済みの内容から始める
  useEffect(() => {
    if (open) setValue(herbInputFromReservation(reservation.herb_choice, reservation.herb_selection));
  }, [open, reservation.herb_choice, reservation.herb_selection]);

  const complete = isHerbInputComplete(value, catalog);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-reservation-herbs", {
        body: {
          reservationCode: reservation.reservation_code,
          accessToken,
          phoneLastFourDigits,
          herbChoice: value.choice,
          herbTiers: herbTiersPayload(value),
        },
      });
      if (error) throw new Error((await extractServerMessage(error)) ?? "ハーブの変更に失敗しました");
      if (data?.error) throw new Error(data.error);
      onSaved(data);
      toast.success("ハーブ蒸しの内容を変更しました");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ハーブの変更に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="u-site max-h-[90vh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-[1.5rem] border-0 bg-u-mist p-5 sm:rounded-[1.5rem] sm:p-7">
        <DialogHeader className="text-left">
          <p className="u-latin text-xl italic text-u-ink/70">Herb steam</p>
          <DialogTitle className="u-display font-medium tracking-[0.08em]">ハーブ蒸しを変更</DialogTitle>
          <DialogDescription className="text-xs text-u-ink/70">変更は利用日の前日24時まで承ります</DialogDescription>
        </DialogHeader>

        <HerbPicker
          catalog={catalog}
          isLoading={isLoading}
          isError={isError}
          value={value}
          onChange={setValue}
          stickyOffsetClass="-top-5 sm:-top-7"
        />

        <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="u-btn u-btn-ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            戻る
          </button>
          <button type="button" className="u-btn u-btn-primary" onClick={handleSave} disabled={saving || !complete}>
            {saving ? "変更中…" : "この内容に変更する"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
