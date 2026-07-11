import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  AdminEvent,
  AdminEventReservation,
  useCancelEventReservationAdmin,
} from "@/hooks/useEventAdmin";
import { formatEventDateLabel, formatEventTimeRange } from "@/utils/eventFormat";

interface EventReservationListProps {
  event: AdminEvent;
}

/** 選択中イベントの全予約一覧（枠横断）+ 管理者キャンセル */
export const EventReservationList = ({ event }: EventReservationListProps) => {
  const cancelReservation = useCancelEventReservationAdmin();
  const [cancelTarget, setCancelTarget] = useState<AdminEventReservation | null>(null);

  const rows = event.event_slots.flatMap((slot) =>
    slot.event_reservations.map((reservation) => ({ slot, reservation })),
  );
  rows.sort((a, b) => b.reservation.created_at.localeCompare(a.reservation.created_at));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">予約一覧（{event.title}）</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">予約はまだありません。</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>枠</TableHead>
                <TableHead>お名前</TableHead>
                <TableHead className="text-right">人数</TableHead>
                <TableHead>連絡先</TableHead>
                <TableHead>コード</TableHead>
                <TableHead className="text-right">料金</TableHead>
                <TableHead>状態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ slot, reservation }) => (
                <TableRow
                  key={reservation.id}
                  className={reservation.status === "cancelled" ? "opacity-50" : ""}
                >
                  <TableCell className="whitespace-nowrap">
                    {formatEventDateLabel(slot.date)}{" "}
                    {formatEventTimeRange(slot.start_time, slot.end_time)}
                  </TableCell>
                  <TableCell className="font-medium">{reservation.guest_name}</TableCell>
                  <TableCell className="text-right">{reservation.guest_count}名</TableCell>
                  <TableCell className="text-sm">
                    <div>{reservation.phone}</div>
                    <div className="text-muted-foreground">{reservation.email}</div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {reservation.reservation_code}
                  </TableCell>
                  <TableCell className="text-right">
                    {reservation.total_price > 0
                      ? `¥${reservation.total_price.toLocaleString()}`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {reservation.status === "confirmed" ? (
                      <Badge>確定</Badge>
                    ) : (
                      <Badge variant="secondary">キャンセル</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {reservation.status === "confirmed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCancelTarget(reservation)}
                      >
                        キャンセル
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>予約をキャンセルしますか?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.guest_name} 様（{cancelTarget?.guest_count}名・
              {cancelTarget?.reservation_code}）の予約をキャンセルします。
              席は自動的に解放されます。お客様への連絡は別途行ってください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>戻る</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (cancelTarget) cancelReservation.mutate(cancelTarget.id);
                setCancelTarget(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              キャンセルする
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
