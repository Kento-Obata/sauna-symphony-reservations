import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Reservation } from "@/types/reservation";

interface ReservationDetailsCardProps {
  reservation: Reservation;
  onModify: () => void;
  onCancel: () => void;
}

export const ReservationDetailsCard = ({
  reservation,
  onModify,
  onCancel,
}: ReservationDetailsCardProps) => {
  const getTimeSlotText = (timeSlot: string) => {
    switch (timeSlot) {
      case "morning":
        return "午前 10:00-12:30";
      case "afternoon":
        return "午後 13:30-16:00";
      case "evening":
        return "夕方 17:00-19:30";
      default:
        return "";
    }
  };

  return (
    <div className="glass-card p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gradient">予約詳細</h1>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h2 className="text-sm text-sauna-stone/60">予約コード</h2>
            <p className="text-lg">{reservation.reservation_code}</p>
          </div>
          
          <div>
            <h2 className="text-sm text-sauna-stone/60">ステータス</h2>
            <p className="text-lg capitalize">
              {reservation.status === "confirmed" ? "予約確定" : "キャンセル済み"}
            </p>
          </div>

          <div>
            <h2 className="text-sm text-sauna-stone/60">日付</h2>
            <p className="text-lg">
              {format(new Date(reservation.date), "yyyy年MM月dd日", { locale: ja })}
            </p>
          </div>

          <div>
            <h2 className="text-sm text-sauna-stone/60">時間帯</h2>
            <p className="text-lg">{getTimeSlotText(reservation.time_slot)}</p>
          </div>

          <div>
            <h2 className="text-sm text-sauna-stone/60">お名前</h2>
            <p className="text-lg">{reservation.guest_name}</p>
          </div>

          <div>
            <h2 className="text-sm text-sauna-stone/60">人数</h2>
            <p className="text-lg">{reservation.guest_count}名</p>
          </div>

          <div>
            <h2 className="text-sm text-sauna-stone/60">メールアドレス</h2>
            <p className="text-lg">{reservation.email || "-"}</p>
          </div>

          <div>
            <h2 className="text-sm text-sauna-stone/60">電話番号</h2>
            <p className="text-lg">{reservation.phone}</p>
          </div>

          <div>
            <h2 className="text-sm text-sauna-stone/60">水風呂温度</h2>
            <p className="text-lg">{reservation.water_temperature}°C</p>
          </div>
        </div>

        {reservation.status === "confirmed" && (
          <div className="flex justify-end gap-4 pt-4">
            <Button variant="outline" onClick={onModify}>
              予約内容を変更
            </Button>
            <Button variant="destructive" onClick={onCancel}>
              予約をキャンセル
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};