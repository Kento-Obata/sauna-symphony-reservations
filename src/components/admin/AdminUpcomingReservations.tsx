import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Reservation } from "@/types/reservation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TIME_SLOTS } from "@/components/TimeSlotSelect";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { XCircle } from "lucide-react";

interface AdminUpcomingReservationsProps {
  reservations?: Reservation[];
  onStatusChange?: (id: string, status: string) => void;
}

export const AdminUpcomingReservations = ({
  reservations = [],
  onStatusChange,
}: AdminUpcomingReservationsProps) => {
  const sortedReservations = [...reservations].sort((a, b) => {
    const dateComparison = a.date.localeCompare(b.date);
    if (dateComparison !== 0) return dateComparison;
    
    const timeSlotOrder = { morning: 0, afternoon: 1, evening: 2 };
    return timeSlotOrder[a.time_slot] - timeSlotOrder[b.time_slot];
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>次回の予約</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedReservations.slice(0, 5).map((reservation) => (
          <div
            key={reservation.id}
            className="border-b last:border-b-0 pb-4 last:pb-0"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-medium">
                  {format(new Date(reservation.date), "M月d日(E)", {
                    locale: ja,
                  })}
                </div>
                <div className="text-sm text-muted-foreground">
                  {TIME_SLOTS[reservation.time_slot].start}-
                  {TIME_SLOTS[reservation.time_slot].end}
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">{reservation.guest_name}様</div>
                <div className="text-sm text-muted-foreground">
                  {reservation.guest_count}名
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <div>水風呂: {reservation.water_temperature}°C</div>
              <div>TEL: {reservation.phone}</div>
              {reservation.email && <div>Email: {reservation.email}</div>}
            </div>
            {reservation.status !== "cancelled" && onStatusChange && (
              <div className="mt-2 flex justify-end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      キャンセル
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>予約をキャンセルしますか？</AlertDialogTitle>
                      <AlertDialogDescription>
                        この操作は取り消せません。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>いいえ</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onStatusChange(reservation.id, "cancelled")}
                      >
                        はい
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        ))}

        {sortedReservations.length === 0 && (
          <div className="text-center text-muted-foreground py-4">
            予約はありません
          </div>
        )}
      </CardContent>
    </Card>
  );
};