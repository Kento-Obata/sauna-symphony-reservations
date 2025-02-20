
import { TIME_SLOTS } from "@/components/TimeSlotSelect";
import { TimeSlot } from "@/types/reservation";
import { useReservations } from "@/hooks/useReservations";
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
  const { data: reservations } = useReservations();

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
              {Object.entries(TIME_SLOTS).map(([key, slot]) => (
                <SelectItem 
                  key={key} 
                  value={key as TimeSlot}
                  disabled={isTimeSlotDisabled(key as TimeSlot)}
                >
                  {slot.start}-{slot.end}
                  {isTimeSlotDisabled(key as TimeSlot) && " (予約済み)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          `${TIME_SLOTS[timeSlot].start}-${TIME_SLOTS[timeSlot].end}`
        )}
      </div>
    </>
  );
};
