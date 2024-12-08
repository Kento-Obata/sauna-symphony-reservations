import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";

interface ReservationDateSelectProps {
  date: string;
  onDateChange: (date: Date) => void;
  isEditing: boolean;
}

export const ReservationDateSelect = ({
  date,
  onDateChange,
  isEditing,
}: ReservationDateSelectProps) => {
  return (
    <>
      <div className="text-muted-foreground">予約日:</div>
      <div>
        {isEditing ? (
          <Calendar
            mode="single"
            selected={new Date(date)}
            onSelect={(date) => date && onDateChange(date)}
            className="rounded-md border"
          />
        ) : (
          format(new Date(date), "yyyy年MM月dd日(E)", {
            locale: ja,
          })
        )}
      </div>
    </>
  );
};