import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { useReservations } from "@/hooks/useReservations";
import { ReservationStatus } from "@/components/ReservationStatus";

interface ReservationDateSelectProps {
  date: string;
  onDateChange: (date: Date) => void;
  isEditing: boolean;
  currentReservationId?: string;
}

export const ReservationDateSelect = ({
  date,
  onDateChange,
  isEditing,
  currentReservationId,
}: ReservationDateSelectProps) => {
  const { data: reservations } = useReservations();

  const getDayContent = (day: Date) => {
    if (!reservations) return null;

    const dateString = format(day, 'yyyy-MM-dd');
    const dateReservations = reservations.filter(
      (r) => r.date === dateString && r.id !== currentReservationId
    );

    const reservationCount = dateReservations.length;
    
    return (
      <div className="w-full h-full flex flex-col items-center justify-start pt-0.5">
        <span>{day.getDate()}</span>
        <div className="text-xs translate-y-[-2px]">
          <ReservationStatus reservationCount={reservationCount} />
        </div>
      </div>
    );
  };

  const isDateDisabled = (day: Date) => {
    if (!reservations) return false;

    const dateString = format(day, 'yyyy-MM-dd');
    const dateReservations = reservations.filter(
      (r) => r.date === dateString && r.id !== currentReservationId
    );

    return dateReservations.length >= 3;
  };

  const formatDisplayDate = (dateString: string) => {
    try {
      const parsedDate = new Date(dateString);
      // Check if the date is valid
      if (isNaN(parsedDate.getTime())) {
        console.error('Invalid date:', dateString);
        return 'Invalid date';
      }
      return format(parsedDate, "yyyy年MM月dd日(E)", {
        locale: ja,
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  return (
    <>
      <div className="text-muted-foreground col-span-2">予約日:</div>
      <div className="col-span-2">
        {isEditing ? (
          <div className="w-full flex justify-center">
            <Calendar
              mode="single"
              selected={new Date(date)}
              onSelect={(date) => date && onDateChange(date)}
              disabled={isDateDisabled}
              className="rounded-md border bg-background"
              components={{
                DayContent: ({ date }) => getDayContent(date)
              }}
            />
          </div>
        ) : (
          formatDisplayDate(date)
        )}
      </div>
    </>
  );
};