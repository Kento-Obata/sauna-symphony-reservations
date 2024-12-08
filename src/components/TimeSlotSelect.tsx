import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimeSlot } from "@/types/reservation";
import { isBefore, addHours, setHours, setMinutes } from "date-fns";

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

export const isTimeSlotDisabled = (slot: TimeSlot, selectedDate: Date) => {
  const now = new Date();
  const twoHoursFromNow = addHours(now, 2);
  
  const [startHour, startMinute] = TIME_SLOTS[slot].start.split(':').map(Number);
  const slotTime = setMinutes(setHours(selectedDate, startHour), startMinute);
  
  return isBefore(slotTime, twoHoursFromNow);
};

const MAX_RESERVATIONS = 3;

export const TimeSlotSelect = ({
  value,
  onValueChange,
  selectedDate,
  timeSlotReservations,
}: TimeSlotSelectProps) => {
  return (
    <div>
      <label className="block text-sm mb-2">時間帯</label>
      <Select 
        onValueChange={(value: TimeSlot) => onValueChange(value)} 
        value={value}
      >
        <SelectTrigger>
          <SelectValue placeholder="時間帯を選択" />
        </SelectTrigger>
        <SelectContent>
          {[
            { value: 'morning', label: '午前 10:00-12:30' },
            { value: 'afternoon', label: '午後 13:30-16:00' },
            { value: 'evening', label: '夕方 17:00-19:30' }
          ].map(({ value, label }) => {
            const isDisabled = selectedDate ? (
              timeSlotReservations[value as TimeSlot] >= MAX_RESERVATIONS ||
              isTimeSlotDisabled(value as TimeSlot, selectedDate)
            ) : false;

            const remainingSlots = MAX_RESERVATIONS - (timeSlotReservations[value as TimeSlot] || 0);

            return (
              <SelectItem 
                key={value} 
                value={value}
                disabled={isDisabled}
              >
                <div className="flex items-center justify-between w-full">
                  <span>{label}</span>
                  {!isDisabled && remainingSlots < MAX_RESERVATIONS && (
                    <span className="text-green-500 text-sm font-medium">
                      残り{remainingSlots}枠
                    </span>
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
};