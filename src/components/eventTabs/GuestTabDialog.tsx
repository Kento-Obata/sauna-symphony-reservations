import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatEventTimeRange } from "@/utils/eventFormat";
import {
  EventTabGuest,
  EventTabItem,
  entryFeeLabel,
  formatYen,
  tabTotal,
  useEventTabAction,
} from "./eventTabs";

interface GuestTabDialogProps {
  token: string | null;
  guest: EventTabGuest | null;
  items: EventTabItem[];
  onClose: () => void;
}

export const GuestTabDialog = ({ token, guest, items, onClose }: GuestTabDialogProps) => {
  const run = useEventTabAction();
  const [busy, setBusy] = useState(false);
  const [confirmUnsettle, setConfirmUnsettle] = useState(false);

  if (!guest) return null;

  const settled = !!guest.settled_at;
  const total = tabTotal(guest.lines);
  const quantityOf = (itemId: string) => guest.lines.find((l) => l.item_id === itemId)?.quantity ?? 0;
  // 品目を無効にしても、すでに記録した明細は表示する
  const shownItems = [
    ...items,
    ...guest.lines
      .filter((l) => !items.some((i) => i.id === l.item_id))
      .map((l) => ({ id: l.item_id, name: "（終了したオプション）", price: l.unit_price })),
  ];

  const change = async (itemId: string, delta: number) => {
    setBusy(true);
    await run(
      () =>
        supabase.rpc("event_tab_add_item", {
          p_token: token,
          p_tab_id: guest.tab_id,
          p_reservation_id: guest.tab_id ? null : guest.reservation_id,
          p_item_id: itemId,
          p_delta: delta,
        }),
      "記録できませんでした",
    );
    setBusy(false);
  };

  const settle = async (value: boolean) => {
    if (!guest.tab_id) return;
    setBusy(true);
    const result = await run(
      () => supabase.rpc("event_tab_settle", { p_token: token, p_tab_id: guest.tab_id!, p_settled: value }),
      value ? "精算できませんでした" : "取り消せませんでした",
    );
    setBusy(false);
    setConfirmUnsettle(false);
    if (result !== undefined) {
      if (value) {
        toast.success(`${guest.guest_name}様 ${formatYen(result ?? 0)} 精算済みにしました`);
        onClose();
      } else {
        toast.success("精算を取り消しました");
      }
    }
  };

  const deleteWalkin = async () => {
    if (!guest.tab_id || !window.confirm(`${guest.guest_name}様を一覧から削除しますか？`)) return;
    setBusy(true);
    const result = await run(
      () => supabase.rpc("event_tab_delete_walkin", { p_token: token, p_tab_id: guest.tab_id! }),
      "削除できませんでした",
    );
    setBusy(false);
    if (result !== undefined) onClose();
  };

  const entryFee = entryFeeLabel(guest);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle>
            {guest.guest_name}様
            {guest.guest_count ? <span className="ml-1 text-sm font-normal">{guest.guest_count}名</span> : null}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {guest.reservation_id ? `予約 ${guest.reservation_code ?? ""}` : "当日飛び込み"}
            {guest.start_time && guest.end_time ? ` / ${formatEventTimeRange(guest.start_time, guest.end_time)}` : ""}
          </p>
        </DialogHeader>

        <ul className="divide-y rounded-lg border">
          {shownItems.map((item) => {
            const qty = quantityOf(item.id);
            return (
              <li key={item.id} className={`flex items-center gap-3 px-3 py-2 ${qty > 0 ? "bg-sky-50" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{formatYen(item.price)}</p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  disabled={busy || settled || qty === 0}
                  onClick={() => change(item.id, -1)}
                  aria-label={`${item.name}を減らす`}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-6 text-center text-lg font-semibold tabular-nums">{qty}</span>
                <Button
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  disabled={busy || settled}
                  onClick={() => change(item.id, 1)}
                  aria-label={`${item.name}を増やす`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>

        <div className="rounded-lg bg-zinc-100 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm">追加オプション料</span>
            <span className="text-2xl font-bold tabular-nums">{formatYen(total)}</span>
          </div>
          {entryFee && <p className="mt-1 text-xs text-muted-foreground">{entryFee}</p>}
          {settled && (
            <p className="mt-1 text-sm font-medium text-emerald-700">
              精算済み {formatYen(guest.settled_amount ?? 0)}
            </p>
          )}
        </div>

        {settled ? (
          confirmUnsettle ? (
            <div className="flex gap-2">
              <Button variant="outline" className="h-11 flex-1" onClick={() => setConfirmUnsettle(false)}>
                戻る
              </Button>
              <Button variant="destructive" className="h-11 flex-1" disabled={busy} onClick={() => settle(false)}>
                精算を取り消す
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="h-11 w-full" onClick={() => setConfirmUnsettle(true)}>
              精算を取り消して直す
            </Button>
          )
        ) : (
          <Button
            className="h-12 w-full bg-emerald-600 text-base hover:bg-emerald-700"
            disabled={busy || !guest.tab_id}
            onClick={() => settle(true)}
          >
            {guest.tab_id ? `${formatYen(total)} を精算済みにする` : "オプションを記録すると精算できます"}
          </Button>
        )}

        {!guest.reservation_id && !settled && (
          <button className="text-xs text-muted-foreground underline" disabled={busy} onClick={deleteWalkin}>
            このお客さんを削除
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
};
