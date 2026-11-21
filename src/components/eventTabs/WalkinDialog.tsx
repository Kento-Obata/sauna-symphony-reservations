import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEventTimeRange } from "@/utils/eventFormat";
import { EventTabSlot, useEventTabAction } from "./eventTabs";

interface WalkinDialogProps {
  open: boolean;
  token: string | null;
  eventId: string;
  slots: EventTabSlot[];
  defaultSlotId: string | null;
  onClose: () => void;
  /** 作成した会計の id */
  onCreated: (tabId: string) => void;
}

/** 当日飛び込みのお客さんを名前だけで追加する */
export const WalkinDialog = ({ open, token, eventId, slots, defaultSlotId, onClose, onCreated }: WalkinDialogProps) => {
  const run = useEventTabAction();
  const [name, setName] = useState("");
  const [count, setCount] = useState(1);
  // null は未選択（既定の枠を使う）、"" は「指定しない」
  const [slotId, setSlotId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("");
    setCount(1);
    setSlotId(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const tabId = await run(
      () =>
        supabase.rpc("event_tab_create_walkin", {
          p_token: token,
          p_event_id: eventId,
          p_slot_id: (slotId ?? defaultSlotId) || null,
          p_guest_name: name.trim(),
          p_guest_count: count,
        }),
      "追加できませんでした",
    );
    setBusy(false);
    if (tabId) {
      reset();
      onCreated(tabId);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md p-4 sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle>飛び込みのお客さんを追加</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="walkin-name">お名前</Label>
            <Input
              id="walkin-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="例: 山田 / 赤いTシャツの方"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>人数</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setCount(n)}
                  className={`h-10 flex-1 rounded-md border text-sm ${
                    count === n ? "border-zinc-900 bg-zinc-900 text-white" : "bg-white"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          {slots.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="walkin-slot">枠</Label>
              <select
                id="walkin-slot"
                value={slotId ?? defaultSlotId ?? ""}
                onChange={(e) => setSlotId(e.target.value)}
                className="h-10 w-full rounded-md border bg-white px-3 text-sm"
              >
                <option value="">指定しない</option>
                {slots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.date.slice(5).replace("-", "/")} {formatEventTimeRange(slot.start_time, slot.end_time)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button type="submit" className="h-11 w-full" disabled={busy || !name.trim()}>
            追加してオプションを記録
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
