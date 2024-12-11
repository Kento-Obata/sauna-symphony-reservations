import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TimeSlot, ReservationFormData } from "@/types/reservation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

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
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const formattedDate = reservation.date
    ? format(new Date(reservation.date), "yyyy年MM月dd日 (E)", {
        locale: ja,
      })
    : "";

  const handleConfirm = () => {
    if (!termsAccepted) {
      toast.error("利用規約に同意してください。");
      return;
    }
    onConfirm();
  };

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
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>上記の内容で予約を確定しますか？</p>
            <p className="mt-2">料金: ¥40,000 (税込)</p>
            <p className="mt-2">受付時間: 予約時間の15分前からご案内いたします。</p>
            <p className="mt-2 text-yellow-600 font-bold">
              ※ 本予約用のSMSとメールが送信されます。
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="terms" 
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
            />
            <Label htmlFor="terms" className="text-sm">
              <a 
                href="/terms" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                利用規約
              </a>
              に同意します
            </Label>
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
              onClick={handleConfirm}
              disabled={isSubmitting || !termsAccepted}
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