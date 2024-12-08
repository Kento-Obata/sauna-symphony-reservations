import { format, isValid } from "date-fns";
import { ja } from "date-fns/locale";
import { MonthSelector } from "./MonthSelector";
import { DaySelector } from "./DaySelector";

interface ReservationCalendarProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  reservations?: any[];
}

export const ReservationCalendar = ({
  date,
  setDate,
  reservations,
}: ReservationCalendarProps) => {
  const handleMonthSelect = (monthStr: string) => {
    try {
      const selectedMonth = new Date(monthStr);
      if (!isValid(selectedMonth)) {
        console.error("Invalid month selected:", monthStr);
        return;
      }
      setDate(selectedMonth);
    } catch (error) {
      console.error("Error selecting month:", error);
    }
  };

  const handleDateSelect = (day: number) => {
    if (!date || !isValid(date)) {
      console.error("Invalid date for day selection:", date);
      return;
    }
    try {
      const newDate = new Date(date.getFullYear(), date.getMonth(), day);
      if (!isValid(newDate)) {
        console.error("Invalid date created:", newDate);
        return;
      }
      setDate(newDate);
    } catch (error) {
      console.error("Error selecting date:", error);
    }
  };

  return (
    <div className="space-y-4 w-full">
      <MonthSelector date={date} onMonthSelect={handleMonthSelect} />
      {date && <DaySelector date={date} onDaySelect={handleDateSelect} />}
    </div>
  );
};