
import { TimeSlot } from "@/types/reservation";
import { useAdminReservations } from "@/hooks/useAdminReservations";
import { useDailyTimeSlots } from "@/hooks/useDailyTimeSlots";
import { isNightSlotDefault, getDefaultSlotTimesForDate } from "@/utils/timeSlotRules";
import { parseISO } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReservationTimeSelectProps {
  timeSlot: TimeSlot;
  onTimeSlotChange: (value: TimeSlot) => void;
  isEditing: boolean;
  date: string;
  currentReservationId: string;
}

export const ReservationTimeSelect = ({
  timeSlot,
  onTimeSlotChange,
  isEditing,
  date,
  currentReservationId,
}: ReservationTimeSelectProps) => {
  const { data: reservations } = useAdminReservations();
  const { data: dailyTimeSlots } = useDailyTimeSlots();

  const isTimeSlotDisabled = (slot: TimeSlot) => {
    if (!reservations) return false;

    const slotReservations = reservations.filter(
      (r) => 
        r.date === date && 
        r.time_slot === slot && 
        r.id !== currentReservationId &&
        (r.status === "confirmed" || r.status === "pending")
    );

    return slotReservations.length >= 1;
  };

  const formatTime = (t: string) => (t ?? "").slice(0, 5);

  const getTimeSlotLabel = (slot: TimeSlot) => {
    const dailySlot = dailyTimeSlots?.find(dts =>
      dts.date === date && dts.time_slot === slot && dts.is_active
    );

    if (dailySlot) {
      return { start: formatTime(dailySlot.start_time), end: formatTime(dailySlot.end_time) };
    }

    const def = getDefaultSlotTimesForDate(parseISO(date), slot, dailyTimeSlots);
    return { start: formatTime(def.start), end: formatTime(def.end) };
  };


  const currentTimeSlotLabel = getTimeSlotLabel(timeSlot);

  return (
    <>
      <div className="text-muted-foreground">時間帯:</div>
      <div>
        {isEditing ? (
          <Select 
            value={timeSlot} 
            onValueChange={(value: TimeSlot) => onTimeSlotChange(value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(() => {
                // 管理画面の編集では午前も選択可能にしておく（平日おやすみ枠への割当・上書き用）。
                const slotKeys: TimeSlot[] = ["morning", "afternoon", "evening"];
                const hasExplicitNight = !!dailyTimeSlots?.some(
                  (dts) => dts.date === date && dts.time_slot === "night" && dts.is_active
                );
                const hasNight = hasExplicitNight || isNightSlotDefault(parseISO(date), dailyTimeSlots);
                if (hasNight || timeSlot === "night") slotKeys.push("night");
                return slotKeys.map((key) => {
                  const timeSlotLabel = getTimeSlotLabel(key);
                  return (
                    <SelectItem
                      key={key}
                      value={key}
                      disabled={isTimeSlotDisabled(key)}
                    >
                      {timeSlotLabel.start}-{timeSlotLabel.end}
                      {isTimeSlotDisabled(key) && " (予約済み)"}
                    </SelectItem>
                  );
                });
              })()}
            </SelectContent>
          </Select>
        ) : (
          `${currentTimeSlotLabel.start}-${currentTimeSlotLabel.end}`
        )}
      </div>
    </>
  );
};
