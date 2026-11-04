import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { StaffWorkItem } from "../staffWorkTypes";
import { formatClock } from "../workUtils";

interface DoneItemDialogProps {
  item: StaffWorkItem | null;
  onClose: () => void;
  onUndo: (logId: string) => Promise<void>;
}

/** 今日記録済みの項目をタップしたとき。記録内容を見せて、取り消しだけできる */
export const DoneItemDialog = ({ item, onClose, onUndo }: DoneItemDialogProps) => {
  const [undoing, setUndoing] = useState(false);
  const log = item?.my_today_log;
  if (!item || !log) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && !undoing && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>今日 {formatClock(log.worked_at)} に記録済みです（+{log.points}pt）</DialogDescription>
        </DialogHeader>
        <dl className="space-y-1 text-sm">
          {log.quantity !== null && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{item.quantity_label ?? "数量"}</dt>
              <dd>
                {log.quantity}
                {log.quantity_unit}
              </dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="text-muted-foreground">写真</dt>
            <dd>{log.photo_count > 0 ? `${log.photo_count}枚` : "なし"}</dd>
          </div>
          {log.note && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">メモ</dt>
              <dd className="whitespace-pre-wrap">{log.note}</dd>
            </div>
          )}
        </dl>
        <p className="text-xs text-muted-foreground">
          同じ作業を記録できるのは1日1回です。間違えた場合は取り消してから記録し直してください
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onClose} disabled={undoing}>
            閉じる
          </Button>
          <Button
            variant="destructive"
            disabled={undoing}
            onClick={async () => {
              setUndoing(true);
              await onUndo(log.id);
              setUndoing(false);
            }}
          >
            記録を取り消す
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
