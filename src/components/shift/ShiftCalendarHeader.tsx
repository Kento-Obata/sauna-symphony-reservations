import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface ShiftCalendarHeaderProps {
  start: Date;
  end: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onAddShift: () => void;
}

export const ShiftCalendarHeader = ({
  start,
  end,
  onPrevWeek,
  onNextWeek,
  onAddShift,
}: ShiftCalendarHeaderProps) => {
  return (
    <div className="flex justify-between items-center p-4 border-b">
      <Button variant="outline" size="icon" onClick={onPrevWeek}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">
          {format(start, "yyyy年MM月dd日", { locale: ja })} -{" "}
          {format(end, "MM月dd日", { locale: ja })}
        </h2>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={onAddShift}
        >
          <Plus className="h-4 w-4" />
          シフト追加
        </Button>
      </div>
      <Button variant="outline" size="icon" onClick={onNextWeek}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};