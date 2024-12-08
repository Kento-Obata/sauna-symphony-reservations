import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getDaysInMonth } from "date-fns";

interface DaySelectorProps {
  date: Date | undefined;
  onDaySelect: (day: number) => void;
}

export const DaySelector = ({ date, onDaySelect }: DaySelectorProps) => {
  if (!date) return null;

  const getDaysArray = (selectedDate: Date) => {
    const daysInMonth = getDaysInMonth(selectedDate);
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
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
              day === date.getDate() &&
              date.getMonth() === dayDate.getMonth();

            return (
              <Button
                key={day}
                variant={isSelected ? "default" : "outline"}
                className="w-full"
                onClick={() => onDaySelect(day)}
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