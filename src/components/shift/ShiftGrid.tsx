import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ShiftCell } from "./ShiftCell";

interface ShiftGridProps {
  days: Date[];
  hours: number[];
  minutes: number[];
  getTimeSlots: (day: Date) => Date[];
  getShiftsForTimeSlot: (timeSlot: Date) => any[];
  calculateShiftStyle: (startTime: Date, endTime: Date, slotTime: Date) => React.CSSProperties | null;
  getStaffColor: (staffId: string | undefined) => string;
  onCellClick: (date: Date) => void;
  onShiftClick: (e: React.MouseEvent, shift: any) => void;
  onShiftDelete: (shiftId: string) => void;
}

export const ShiftGrid = ({
  days,
  hours,
  minutes,
  getTimeSlots,
  getShiftsForTimeSlot,
  calculateShiftStyle,
  getStaffColor,
  onCellClick,
  onShiftClick,
  onShiftDelete,
}: ShiftGridProps) => {
  return (
    <>
      {days.map((day) => (
        <div key={day.toString()} className="col-span-1">
          <div className="h-16 border-b p-2 text-center">
            <div className="font-medium text-sm">{format(day, "M/d")}</div>
            <div className="text-xs text-gray-500">
              {format(day, "E", { locale: ja })}
            </div>
          </div>
        </div>
      ))}
      {hours.map((hour) =>
        minutes.map((minute, minuteIndex) =>
          days.map((day) => {
            const time = getTimeSlots(day)[hour * 2 + minuteIndex];
            const shiftsInSlot = getShiftsForTimeSlot(time);
            return (
              <div
                key={`${day}-${hour}-${minute}`}
                className="col-span-1 h-7 border-b hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer relative"
                onClick={() => onCellClick(time)}
              >
                {shiftsInSlot.map((shift) => {
                  const style = calculateShiftStyle(
                    new Date(shift.start_time),
                    new Date(shift.end_time),
                    time
                  );
                  if (!style) return null;

                  return (
                    <ShiftCell
                      key={shift.id}
                      shift={shift}
                      style={style}
                      onClick={(e) => onShiftClick(e, shift)}
                      onDelete={() => onShiftDelete(shift.id)}
                      color={getStaffColor((shift.profiles as any)?.id)}
                    />
                  );
                })}
              </div>
            );
          })
        )
      )}
    </>
  );
};