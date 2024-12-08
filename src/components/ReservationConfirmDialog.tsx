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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ReservationFormData } from "@/types/reservation";
import { format } from "date-fns";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";

interface ReservationConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: "cash" | "online") => void;
  reservation: ReservationFormData;
  onEdit: () => void;
  isSubmitting?: boolean;
  reservationCode?: string;
}

const TIME_SLOTS = {
  morning: "10:00-12:30",
  afternoon: "13:30-16:00",
  evening: "17:00-19:30",
};

export function ReservationConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  reservation,
  onEdit,
  isSubmitting = false,
  reservationCode,
}: ReservationConfirmDialogProps) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"cash" | "online">("cash");

  const handlePaymentMethodSelect = (method: "cash" | "online") => {
    setSelectedPaymentMethod(method);
  };

  const handleConfirm = () => {
    onConfirm(selectedPaymentMethod);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-[500px]">
        {reservationCode ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>予約が完了しました</AlertDialogTitle>
              <AlertDialogDescription>
                予約コード: <span className="font-bold">{reservationCode}</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <p className="text-center text-muted-foreground">
                予約内容の確認メールをお送りしました。
                {selectedPaymentMethod === "cash" && "当日は現金でのお支払いをお願いいたします。"}
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogAction onClick={onClose}>
                閉じる
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>予約内容の確認</AlertDialogTitle>
              <AlertDialogDescription>
                予約内容とお支払い方法をご確認ください。
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <h4 className="font-medium">予約詳細</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">日付:</div>
                  <div>{format(new Date(reservation.date), "yyyy/MM/dd")}</div>
                  
                  <div className="text-muted-foreground">時間:</div>
                  <div>{TIME_SLOTS[reservation.time_slot]}</div>
                  
                  <div className="text-muted-foreground">お名前:</div>
                  <div>{reservation.guest_name}</div>
                  
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
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">お支払い方法</h4>
                <RadioGroup 
                  value={selectedPaymentMethod} 
                  onValueChange={(value: "cash" | "online") => handlePaymentMethodSelect(value)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cash" id="cash" />
                    <Label htmlFor="cash">現地でのお支払い (¥40,000)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="online" id="online" />
                    <Label htmlFor="online">オンライン決済 (¥40,000)</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              {isSubmitting ? (
                <div className="w-full space-y-2">
                  <Progress value={40} className="w-full" />
                  <p className="text-center text-sm text-muted-foreground">
                    予約を処理中です...
                  </p>
                </div>
              ) : (
                <>
                  <Button variant="outline" onClick={onEdit}>
                    内容を修正
                  </Button>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirm}>
                    予約を確定
                  </AlertDialogAction>
                </>
              )}
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}