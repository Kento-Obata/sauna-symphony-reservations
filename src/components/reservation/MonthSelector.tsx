import { format, addMonths } from "date-fns";
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
  const months = Array.from({ length: 12 }, (_, i) => addMonths(today, i));

  return (
    <div>
      <label className="block text-sm mb-2">月を選択 *</label>
      <Select
        value={date ? format(date, "yyyy-MM") : undefined}
        onValueChange={onMonthSelect}
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