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
                <TableHead>支払い</TableHead>
                <TableHead>状態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ slot, reservation }) => (
                <TableRow
                  key={reservation.id}
                  className={
                    reservation.status === "cancelled" || reservation.status === "expired"
                      ? "opacity-50"
                      : ""
                  }
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
                    {reservation.payment_status === "paid" ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">支払済</Badge>
                    ) : reservation.payment_status === "refunded" ? (
                      <Badge variant="outline">返金済</Badge>
                    ) : reservation.payment_method === "square_online" ? (
                      <Badge variant="secondary">未決済</Badge>
                    ) : (
                      <Badge variant="secondary">現地払い</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {reservation.status === "confirmed" ? (
                      <Badge>確定</Badge>
                    ) : reservation.status === "pending_payment" ? (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                        決済待ち
                      </Badge>
                    ) : reservation.status === "expired" ? (
                      <Badge variant="outline">期限切れ</Badge>
                    ) : (
                      <Badge variant="secondary">キャンセル</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {(reservation.status === "confirmed" ||
                      reservation.status === "pending_payment") && (
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
              席は自動的に解放され、お客様へキャンセルメールが送信されます。
              {cancelTarget?.payment_status === "paid" &&
                "支払い済みのため、Square で全額が自動返金されます（決済手数料は戻りません）。"}
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
