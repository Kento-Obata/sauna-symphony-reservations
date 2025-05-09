
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
  onStatusChange?: (id: string, status: string, isConfirmed: boolean) => void;
}

export const AdminUpcomingReservations = ({
  reservations = [],
  onStatusChange,
}: AdminUpcomingReservationsProps) => {
  const nextReservation = reservations[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>次回の予約</CardTitle>
      </CardHeader>
      <CardContent>
        {nextReservation ? (
          <div>
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-medium">
                  {format(new Date(nextReservation.date), "M月d日(E)", {
                    locale: ja,
                  })}
                </div>
                <div className="text-sm text-muted-foreground">
                  {TIME_SLOTS[nextReservation.time_slot].start}-
                  {TIME_SLOTS[nextReservation.time_slot].end}
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">{nextReservation.guest_name}様</div>
                <div className="text-sm text-muted-foreground">
                  {nextReservation.guest_count}名
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <div>水風呂: {nextReservation.water_temperature}°C</div>
              <div>TEL: {nextReservation.phone}</div>
              {nextReservation.email && <div>Email: {nextReservation.email}</div>}
            </div>
            {nextReservation.status !== "cancelled" && onStatusChange && (
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
                        onClick={() => onStatusChange(nextReservation.id, "cancelled", true)}
                      >
                        はい
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-4">
            予約はありません
          </div>
        )}
      </CardContent>
    </Card>
  );
};
