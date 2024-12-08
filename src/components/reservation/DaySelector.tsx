import { getDaysInMonth, isValid } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DaySelectorProps {
  date: Date | undefined;
  onDaySelect: (day: number) => void;
}

export const DaySelector = ({ date, onDaySelect }: DaySelectorProps) => {
  if (!date || !isValid(date)) {
    console.log("Invalid or missing date in DaySelector:", date);
    return null;
  }

  const getDaysArray = (selectedDate: Date) => {
    if (!isValid(selectedDate)) {
      console.error("Invalid date for days array:", selectedDate);
      return [];
    }
    const daysInMonth = getDaysInMonth(selectedDate);
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  const handleDaySelect = (dayStr: string) => {
    try {
      const day = parseInt(dayStr, 10);
      if (isNaN(day)) {
        console.error("Invalid day selected:", dayStr);
        return;
      }
      onDaySelect(day);
    } catch (error) {
      console.error("Error selecting day:", error);
    }
  };

  return (
    <div>
      <label className="block text-sm mb-2">日付を選択 *</label>
      <Select
        value={date.getDate().toString()}
        onValueChange={handleDaySelect}
      >
        <SelectTrigger>
          <SelectValue placeholder="日付を選択" />
        </SelectTrigger>
        <SelectContent>
          {getDaysArray(date).map((day) => (
            <SelectItem
              key={day}
              value={day.toString()}
            >
              {day}日
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};