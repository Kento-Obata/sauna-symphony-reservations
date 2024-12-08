import { TIME_SLOTS } from "@/components/TimeSlotSelect";
import { TimeSlot } from "@/types/reservation";
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
}

export const ReservationTimeSelect = ({
  timeSlot,
  onTimeSlotChange,
  isEditing,
}: ReservationTimeSelectProps) => {
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
                <SelectItem key={key} value={key as TimeSlot}>
                  {slot.start}-{slot.end}
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