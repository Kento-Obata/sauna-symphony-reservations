
import { TIME_SLOTS } from "@/components/TimeSlotSelect";
import { TimeSlot } from "@/types/reservation";
import { useAdminReservations } from "@/hooks/useAdminReservations";
import { useDailyTimeSlots } from "@/hooks/useDailyTimeSlots";
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

  const getTimeSlotLabel = (slot: TimeSlot) => {
    const dailySlot = dailyTimeSlots?.find(dts => 
      dts.date === date && dts.time_slot === slot && dts.is_active
    );
    
    if (dailySlot) {
      return { start: dailySlot.start_time, end: dailySlot.end_time };
    }
    
    return TIME_SLOTS[slot];
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
              {Object.entries(TIME_SLOTS).map(([key, slot]) => {
                const timeSlotLabel = getTimeSlotLabel(key as TimeSlot);
                return (
                  <SelectItem 
                    key={key} 
                    value={key as TimeSlot}
                    disabled={isTimeSlotDisabled(key as TimeSlot)}
                  >
                    {timeSlotLabel.start}-{timeSlotLabel.end}
                    {isTimeSlotDisabled(key as TimeSlot) && " (予約済み)"}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        ) : (
          `${currentTimeSlotLabel.start}-${currentTimeSlotLabel.end}`
        )}
      </div>
    </>
  );
};
