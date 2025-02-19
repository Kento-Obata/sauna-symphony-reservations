
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TimeSlot, ReservationFormData } from "@/types/reservation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getTotalPrice, getSurcharge, formatPrice } from "@/utils/priceCalculations";

const timeSlotLabels: Record<TimeSlot, string> = {
  morning: "午前",
  afternoon: "午後",
  evening: "夜",
};

interface ReservationConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onEdit: () => void;
  reservation: ReservationFormData;
  isSubmitting: boolean;
  reservationCode?: string;
}

export const ReservationConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  onEdit,
  reservation,
  isSubmitting,
  reservationCode,
}: ReservationConfirmDialogProps) => {
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const surcharge = getSurcharge(reservation.water_temperature);

  useEffect(() => {
    const calculatePrice = async () => {
      try {
        const price = await getTotalPrice(
          reservation.guest_count,
          reservation.water_temperature
        );
        setTotalPrice(price);
      } catch (error) {
        console.error("料金の計算に失敗しました:", error);
      }
    };

    calculatePrice();
  }, [reservation.guest_count, reservation.water_temperature]);

  const formattedDate = reservation.date
    ? format(new Date(reservation.date), "yyyy年MM月dd日 (E)", {
        locale: ja,
      })
    : "";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>予約内容の確認</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">日付</div>
            <div>{formattedDate}</div>

            <div className="text-muted-foreground">時間帯</div>
            <div>{timeSlotLabels[reservation.time_slot]}</div>

            <div className="text-muted-foreground">お名前</div>
            <div>{reservation.guest_name}</div>

            <div className="text-muted-foreground">人数</div>
            <div>{reservation.guest_count}名様</div>

            {reservation.email && (
              <>
                <div className="text-muted-foreground">メールアドレス</div>
                <div>{reservation.email}</div>
              </>
            )}

            <div className="text-muted-foreground">電話番号</div>
            <div>{reservation.phone}</div>

            <div className="text-muted-foreground">水風呂温度</div>
            <div>{reservation.water_temperature}℃</div>

            <div className="text-muted-foreground">料金</div>
            <div>
              {formatPrice(totalPrice)}
              {surcharge > 0 && (
                <span className="block text-xs text-muted-foreground">
                  （水温オプション料金 +{formatPrice(surcharge)}を含む）
                </span>
              )}
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>上記の内容で予約を確定しますか？</p>
            {reservation.water_temperature <= 10 && (
              <p className="mt-2 text-red-500">
                ※ 10℃以下は本当に冷たいです。入ったことのない方はご注意ください。
              </p>
            )}
            <p className="mt-2">受付時間: 予約時間の15分前からご案内いたします。</p>
            <p className="mt-2 text-yellow-600 font-bold">
              ※ 本予約用のSMSとメールが送信されます。
            </p>
          </div>

          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              onClick={onEdit}
              disabled={isSubmitting}
            >
              修正する
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  予約中...
                </>
              ) : (
                "仮予約へ進む"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
