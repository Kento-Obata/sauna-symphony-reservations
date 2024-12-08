import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Reservation } from "@/types/reservation";
import { TIME_SLOTS } from "@/components/TimeSlotSelect";

interface AdminReservationDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
}

export const AdminReservationDetailsDialog = ({
  open,
  onOpenChange,
  reservation,
}: AdminReservationDetailsDialogProps) => {
  if (!reservation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>予約詳細</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-muted-foreground">予約日:</div>
            <div>
              {format(new Date(reservation.date), "yyyy年MM月dd日(E)", {
                locale: ja,
              })}
            </div>

            <div className="text-muted-foreground">時間帯:</div>
            <div>
              {TIME_SLOTS[reservation.time_slot].start}-
              {TIME_SLOTS[reservation.time_slot].end}
            </div>

            <div className="text-muted-foreground">お名前:</div>
            <div>{reservation.guest_name}様</div>

            <div className="text-muted-foreground">人数:</div>
            <div>{reservation.guest_count}名</div>

            <div className="text-muted-foreground">電話番号:</div>
            <div>{reservation.phone}</div>

            {reservation.email && (
              <>
                <div className="text-muted-foreground">メールアドレス:</div>
                <div>{reservation.email}</div>
              </>
            )}

            <div className="text-muted-foreground">水風呂温度:</div>
            <div>{reservation.water_temperature}°C</div>

            <div className="text-muted-foreground">予約コード:</div>
            <div>{reservation.reservation_code}</div>

            <div className="text-muted-foreground">ステータス:</div>
            <div>
              {reservation.status === "cancelled" ? "キャンセル済み" : "予約確定"}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};