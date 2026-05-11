
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
import { shouldApplyDefault4Slot } from "@/utils/timeSlotRules";

export const TIME_SLOTS = {
  morning: { start: '10:00', end: '12:30' },
  afternoon: { start: '13:30', end: '16:00' },
  evening: { start: '17:00', end: '19:30' }
} as const;

// Optional slots are only displayed when explicitly enabled per-date via daily_time_slots.
// Do NOT add these to TIME_SLOTS — keeping them separate guarantees existing pages
// render the same 3-slot UI when night is not configured.
export const OPTIONAL_TIME_SLOTS = {
  night: { start: '20:00', end: '22:30' },
} as const;

export const ALL_TIME_SLOT_DEFAULTS: Record<TimeSlot, { start: string; end: string }> = {
  ...TIME_SLOTS,
  ...OPTIONAL_TIME_SLOTS,
};

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
  
  const startTime = dailySlot?.start_time || ALL_TIME_SLOT_DEFAULTS[slot]?.start || TIME_SLOTS[slot as keyof typeof TIME_SLOTS]?.start;
  if (!startTime) return true;
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
    const fallback = ALL_TIME_SLOT_DEFAULTS[slot];
    if (!selectedDate) return fallback;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dailySlot = dailyTimeSlots?.find(dts => 
      dts.date === dateStr && dts.time_slot === slot && dts.is_active
    );
    
    if (dailySlot) {
      return { start: dailySlot.start_time, end: dailySlot.end_time };
    }
    
    return fallback;
  };

  // Build the list of slots to render. Always include the 3 default slots so
  // the existing UI is unchanged. Append `night` only when the selected date
  // has an active night row in daily_time_slots.
  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const hasNight = !!(dateStr && dailyTimeSlots?.some(
    (dts) => dts.date === dateStr && dts.time_slot === 'night' && dts.is_active
  ));

  const slotOptions: { value: TimeSlot; label: string }[] = [
    { value: 'morning', label: '午前' },
    { value: 'afternoon', label: '午後' },
    { value: 'evening', label: '夕方' },
  ];
  if (hasNight) slotOptions.push({ value: 'night', label: '夜' });

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
          {slotOptions.map(({ value, label }) => {
            const timeSlot = getTimeSlotLabel(value);
            const displayLabel = `${label} ${timeSlot.start.slice(0, 5)}-${timeSlot.end.slice(0, 5)}`;
            const reservationCount = timeSlotReservations[value] ?? 0;
            const isDisabled = selectedDate
              ? (isTimeSlotDisabled(value, selectedDate, dailyTimeSlots) ||
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
