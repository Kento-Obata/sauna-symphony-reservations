
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TimeSlot, ReservationFormData } from "@/types/reservation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getTotalPrice, getSurcharge, formatPrice } from "@/utils/priceCalculations";
import { useOptions } from "@/hooks/useOptions";
import { Option } from "@/types/option";
import { useDailyTimeSlots } from "@/hooks/useDailyTimeSlots";
const TIME_SLOTS = {
  morning: { start: "10:00", end: "12:30" },
  afternoon: { start: "13:30", end: "16:00" },
  evening: { start: "17:00", end: "19:30" },
};

const getTimeSlotDisplay = (timeSlot: TimeSlot, date: string, dailyTimeSlots: any[]) => {
  const dailySlot = dailyTimeSlots?.find(dts => 
    dts.date === date && dts.time_slot === timeSlot && dts.is_active
  );
  
  if (dailySlot) {
    return `${dailySlot.start_time.slice(0, 5)}-${dailySlot.end_time.slice(0, 5)}`;
  }
  
  const defaultSlot = TIME_SLOTS[timeSlot];
  return `${defaultSlot.start}-${defaultSlot.end}`;
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
  const surcharge = getSurcharge(reservation.water_temperature.toString());
  const { data: dailyTimeSlots } = useDailyTimeSlots();
  const { data: options } = useOptions();

  // 選択されたオプションの情報を取得
  const selectedOptions = options?.filter(option => 
    reservation.options?.some(selectedOption => selectedOption.option_id === option.id)
  ) || [];

  // オプションの合計金額を計算
  const calculateOptionsTotalPrice = (options: Option[], selectedOptions: ReservationFormData["options"] = []) => {
    return selectedOptions.reduce((total, selectedOption) => {
      const option = options.find(opt => opt.id === selectedOption.option_id);
      if (option) {
        return total + (option.price_per_person * selectedOption.quantity);
      }
      return total;
    }, 0);
  };

  useEffect(() => {
    const calculatePrice = async () => {
      try {
        // 日付文字列をDateオブジェクトに変換
        const dateObj = reservation.date ? new Date(reservation.date) : undefined;
        console.log('Calculating price for date:', dateObj);
        
        const basePrice = await getTotalPrice(
          reservation.guest_count,
          reservation.water_temperature.toString(),
          dateObj
        );

        // オプション料金を加算
        const optionsPrice = calculateOptionsTotalPrice(options || [], reservation.options);
        setTotalPrice(basePrice + optionsPrice);
      } catch (error) {
        console.error("料金の計算に失敗しました:", error);
      }
    };

    calculatePrice();
  }, [reservation.guest_count, reservation.water_temperature, reservation.date, reservation.options, options]);

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
            <div>{getTimeSlotDisplay(reservation.time_slot, reservation.date, dailyTimeSlots || [])}</div>

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
            <div>
              {reservation.water_temperature}℃
              {surcharge > 0 && (
                <div className="text-xs text-muted-foreground">
                  ※ 水温オプション料金 +{formatPrice(surcharge)} が適用されます
                </div>
              )}
            </div>

            {selectedOptions.length > 0 && (
              <>
                <div className="text-muted-foreground">オプション</div>
                <div>
                  <ul className="space-y-1">
                    {selectedOptions.map(option => {
                      const selectedOption = reservation.options?.find(o => o.option_id === option.id);
                      const quantity = selectedOption?.quantity || 0;
                      return (
                        <li key={option.id} className="text-sm">
                          {option.name} ({formatPrice(option.price_per_person)}/人) × {quantity}名様
                          <span className="block text-xs text-muted-foreground">
                            小計: {formatPrice(option.price_per_person * quantity)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            )}

            <div className="text-muted-foreground">料金</div>
            <div>
              {formatPrice(totalPrice)}
              {surcharge > 0 && (
                <span className="block text-xs text-muted-foreground">
                  ※ 水温オプション料金 +{formatPrice(surcharge)}を含む
                </span>
              )}
              {selectedOptions.length > 0 && (
                <span className="block text-xs text-muted-foreground">
                  ※ オプション料金 +{formatPrice(calculateOptionsTotalPrice(options || [], reservation.options))}を含む
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
            <p className="mt-2">受付時間: 予約時間の10分前からご案内いたします。</p>
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
