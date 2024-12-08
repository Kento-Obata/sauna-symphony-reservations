import { format, addMonths, isValid } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MonthSelectorProps {
  date: Date | undefined;
  onMonthSelect: (monthStr: string) => void;
}

export const MonthSelector = ({ date, onMonthSelect }: MonthSelectorProps) => {
  const today = new Date();
  const months = Array.from({ length: 3 }, (_, i) => {
    const month = addMonths(today, i);
    return isValid(month) ? month : today;
  });

  const handleMonthSelect = (value: string) => {
    try {
      const selectedDate = new Date(value);
      if (!isValid(selectedDate)) {
        console.error("Invalid month selected:", value);
        return;
      }
      onMonthSelect(value);
    } catch (error) {
      console.error("Error selecting month:", error);
    }
  };

  return (
    <div>
      <label className="block text-sm mb-2">月を選択 *</label>
      <Select
        value={date && isValid(date) ? format(date, "yyyy-MM") : undefined}
        onValueChange={handleMonthSelect}
      >
        <SelectTrigger>
          <SelectValue placeholder="月を選択" />
        </SelectTrigger>
        <SelectContent>
          {months.map((month) => (
            <SelectItem
              key={format(month, "yyyy-MM")}
              value={format(month, "yyyy-MM")}
            >
              {format(month, "yyyy年MM月", { locale: ja })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};