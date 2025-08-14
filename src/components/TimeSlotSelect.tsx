
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimeSlot } from "@/types/reservation";
import { isBefore, addHours, setHours, setMinutes, format } from "date-fns";
import { useDailyTimeSlots } from "@/hooks/useDailyTimeSlots";

export const TIME_SLOTS = {
  morning: { start: '10:00', end: '12:30' },
  afternoon: { start: '13:30', end: '16:00' },
  evening: { start: '17:00', end: '19:30' }
} as const;

interface TimeSlotSelectProps {
  value: string;
  onValueChange: (value: TimeSlot) => void;
  selectedDate?: Date;
  timeSlotReservations: Record<TimeSlot, number>;
}

export const isTimeSlotDisabled = (slot: TimeSlot, selectedDate: Date, dailyTimeSlots?: any[]) => {
  const now = new Date();
  const twoHoursFromNow = addHours(now, 2);
  
  // Get start time from daily time slots or fallback to default
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dailySlot = dailyTimeSlots?.find(dts => 
    dts.date === dateStr && dts.time_slot === slot && dts.is_active
  );
  
  const startTime = dailySlot?.start_time || TIME_SLOTS[slot].start;
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const slotTime = setMinutes(setHours(selectedDate, startHour), startMinute);
  
  return isBefore(slotTime, twoHoursFromNow);
};

const MAX_RESERVATIONS = 1;

export const TimeSlotSelect = ({
  value,
  onValueChange,
  selectedDate,
  timeSlotReservations,
}: TimeSlotSelectProps) => {
  const { data: dailyTimeSlots } = useDailyTimeSlots();
  
  const getTimeSlotLabel = (slot: TimeSlot) => {
    if (!selectedDate) return TIME_SLOTS[slot];
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dailySlot = dailyTimeSlots?.find(dts => 
      dts.date === dateStr && dts.time_slot === slot && dts.is_active
    );
    
    if (dailySlot) {
      return { start: dailySlot.start_time, end: dailySlot.end_time };
    }
    
    return TIME_SLOTS[slot];
  };

  return (
    <div className="space-y-2">
      <Select 
        onValueChange={(value: TimeSlot) => onValueChange(value)} 
        value={value}
      >
        <SelectTrigger>
          <SelectValue placeholder="時間帯を選択" />
        </SelectTrigger>
        <SelectContent>
          {[
            { value: 'morning', label: '午前' },
            { value: 'afternoon', label: '午後' },
            { value: 'evening', label: '夕方' }
          ].map(({ value, label }) => {
            const timeSlot = getTimeSlotLabel(value as TimeSlot);
            const displayLabel = `${label} ${timeSlot.start.slice(0, 5)}-${timeSlot.end.slice(0, 5)}`;
            const reservationCount = timeSlotReservations[value as TimeSlot];
            const isDisabled = selectedDate 
              ? (isTimeSlotDisabled(value as TimeSlot, selectedDate, dailyTimeSlots) || 
                 reservationCount >= MAX_RESERVATIONS)
              : true;
            const statusLabel = reservationCount > 0 
              ? `(予約済み: ${reservationCount}件)`
              : '';

            return (
              <SelectItem 
                key={value} 
                value={value}
                disabled={isDisabled}
              >
                <div>
                  <div>{displayLabel} {statusLabel}</div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
};
