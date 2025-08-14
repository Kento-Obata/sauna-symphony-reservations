
import { format } from "date-fns";
import { Reservation } from "@/types/reservation";
import { getTotalPrice, getSurcharge, formatPrice } from "@/utils/priceCalculations";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Option } from "@/types/option";

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
  const [options, setOptions] = useState<{option: Option, quantity: number}[]>([]);
  const surcharge = getSurcharge(reservation.water_temperature.toString());

  // オプション情報を取得
  useEffect(() => {
    const fetchReservationOptions = async () => {
      try {
        console.log("Fetching options for reservation ID:", reservation.id);
        
        if (!reservation.id) {
          console.log("No reservation ID provided");
          return;
        }
        
        const { data: reservationOptions, error } = await supabase
          .from("reservation_options")
          .select(`
            quantity,
            options:option_id (
              id, name, description, price_per_person
            )
          `)
          .eq("reservation_id", reservation.id);

        if (error) {
          console.error("オプション情報の取得に失敗しました:", error);
          return;
        }

        // オプション情報を整形
        if (reservationOptions && reservationOptions.length > 0) {
          console.log("Found reservation options:", reservationOptions);
          const formattedOptions = reservationOptions.map(item => ({
            option: item.options as unknown as Option, // Cast to unknown first, then to Option
            quantity: item.quantity
          }));
          setOptions(formattedOptions);
        } else {
          console.log("No options found for this reservation");
        }
      } catch (error) {
        console.error("オプション情報の取得中にエラーが発生しました:", error);
      }
    };

    if (reservation.id) {
      fetchReservationOptions();
    }
  }, [reservation.id]);

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

  // オプションの合計金額を計算
  const calculateOptionsTotal = () => {
    return options.reduce((total, item) => {
      return total + (item.option.price_per_person * item.quantity);
    }, 0);
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
      <div>{reservation.guest_name?.replace(/(..).+/, '$1○○')}</div>
      
      <div className="text-sauna-stone">人数:</div>
      <div>{reservation.guest_count}名</div>
      
      <div className="text-sauna-stone">電話番号:</div>
      <div>{reservation.phone?.replace(/(\d{3})-?\d{4}-?(\d{4})/, '$1-****-$2')}</div>
      
      {reservation.email && (
        <>
          <div className="text-sauna-stone">メールアドレス:</div>
          <div>{reservation.email.replace(/(.{2})[^@]*(@.*)/, '$1***$2')}</div>
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

      {options.length > 0 && (
        <>
          <div className="text-sauna-stone">選択オプション:</div>
          <div>
            <ul className="space-y-1">
              {options.map((item, index) => (
                <li key={index} className="text-sm">
                  {item.option.name} ({formatPrice(item.option.price_per_person)}/人) × {item.quantity}名様
                  <span className="block text-xs text-muted-foreground">
                    小計: {formatPrice(item.option.price_per_person * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="text-sauna-stone">料金:</div>
      <div>
        {formatPrice(reservation.total_price)} (税込)
        {(surcharge > 0 || options.length > 0) && (
          <div className="text-xs text-muted-foreground">
            {surcharge > 0 && (
              <div>※ 水温オプション料金 +{formatPrice(surcharge)} を含む</div>
            )}
            {options.length > 0 && (
              <div>※ オプション料金 +{formatPrice(calculateOptionsTotal())} を含む</div>
            )}
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
