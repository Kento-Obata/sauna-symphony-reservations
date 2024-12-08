import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getDaysInMonth, isValid } from "date-fns";

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

  const handleDaySelect = (day: number) => {
    try {
      const newDate = new Date(date.getFullYear(), date.getMonth(), day);
      if (!isValid(newDate)) {
        console.error("Invalid date created:", newDate);
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
      <ScrollArea className="h-[200px] border rounded-md p-2">
        <div className="grid grid-cols-4 gap-2">
          {getDaysArray(date).map((day) => {
            const dayDate = new Date(
              date.getFullYear(),
              date.getMonth(),
              day
            );
            const isSelected =
              date &&
              isValid(date) &&
              isValid(dayDate) &&
              day === date.getDate() &&
              date.getMonth() === dayDate.getMonth();

            return (
              <Button
                key={day}
                variant={isSelected ? "default" : "outline"}
                className="w-full"
                onClick={() => handleDaySelect(day)}
              >
                {day}日
              </Button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};