
import { format } from "date-fns";
import { Reservation } from "@/types/reservation";
import { getTotalPrice, getSurcharge, formatPrice } from "@/utils/priceCalculations";
import { useEffect, useState } from "react";

const TIME_SLOTS = {
  morning: "10:00-12:30",
  afternoon: "13:30-16:00",
  evening: "17:00-19:30",
};

interface ReservationInfoProps {
  reservation: Reservation;
}

export const ReservationInfo = ({ reservation }: ReservationInfoProps) => {
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const surcharge = getSurcharge(reservation.water_temperature.toString());

  useEffect(() => {
    const calculatePrice = async () => {
      try {
        // 日付文字列をDateオブジェクトに変換
        const dateObj = reservation.date ? new Date(reservation.date) : undefined;
        console.log('ReservationInfo - Calculating price for date:', dateObj);
        
        const price = await getTotalPrice(
          reservation.guest_count,
          reservation.water_temperature.toString(),
          dateObj
        );
        setTotalPrice(price);
      } catch (error) {
        console.error("料金の計算に失敗しました:", error);
      }
    };

    calculatePrice();
  }, [reservation.guest_count, reservation.water_temperature, reservation.date]);

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "pending":
        return "仮予約";
      case "confirmed":
        return "予約確定";
      case "cancelled":
        return "キャンセル済み";
      default:
        return status;
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="text-sauna-stone">予約コード:</div>
      <div>{reservation.reservation_code}</div>
      
      <div className="text-sauna-stone">日付:</div>
      <div>{format(new Date(reservation.date), "yyyy年MM月dd日")}</div>
      
      <div className="text-sauna-stone">時間:</div>
      <div>{TIME_SLOTS[reservation.time_slot]}</div>
      
      <div className="text-sauna-stone">お名前:</div>
      <div>{reservation.guest_name}</div>
      
      <div className="text-sauna-stone">人数:</div>
      <div>{reservation.guest_count}名</div>
      
      <div className="text-sauna-stone">電話番号:</div>
      <div>{reservation.phone}</div>
      
      {reservation.email && (
        <>
          <div className="text-sauna-stone">メールアドレス:</div>
          <div>{reservation.email}</div>
        </>
      )}
      
      <div className="text-sauna-stone">水風呂温度:</div>
      <div>
        {reservation.water_temperature}°C
        {surcharge > 0 && (
          <div className="text-xs text-muted-foreground">
            ※ 水温オプション料金 +{formatPrice(surcharge)} が適用されます
          </div>
        )}
      </div>

      <div className="text-sauna-stone">料金:</div>
      <div>
        {formatPrice(totalPrice)} (税込)
        {surcharge > 0 && (
          <div className="text-xs text-muted-foreground">
            ※ 水温オプション料金 +{formatPrice(surcharge)} を含む
          </div>
        )}
      </div>

      <div className="text-sauna-stone">ステータス:</div>
      <div className={reservation.status === 'cancelled' ? 'text-red-500' : reservation.status === 'pending' ? 'text-yellow-500' : 'text-green-500'}>
        {getStatusDisplay(reservation.status)}
      </div>
    </div>
  );
};
