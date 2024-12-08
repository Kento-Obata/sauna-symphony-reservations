import { Calendar } from "@/components/ui/calendar";
import { isBefore, format } from "date-fns";
import { ReservationStatus } from "@/components/ReservationStatus";
import { Reservation } from "@/types/reservation";
import { Minus, Plus } from "lucide-react";

interface ReservationCalendarProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  reservations: Reservation[] | undefined;
}

export const ReservationCalendar = ({
  date,
  setDate,
  reservations,
}: ReservationCalendarProps) => {
  const getDayContent = (day: Date) => {
    if (!reservations || isBefore(day, new Date())) return null;

    const dateString = format(day, 'yyyy-MM-dd');
    const dateReservations = reservations.filter(
      (r) => r.date === dateString
    );

    const reservationCount = dateReservations.length;
    
    return (
      <div className="w-full flex flex-col items-center justify-start gap-0.5">
        <span className="text-sm">{day.getDate()}</span>
        <div className="text-[10px] flex items-center gap-0.5">
          {reservationCount === 0 ? (
            <Plus className="w-3 h-3 text-green-500" />
          ) : reservationCount >= 3 ? (
            <Minus className="w-3 h-3 text-red-500" />
          ) : (
            <span className="text-yellow-500 font-medium">{3 - reservationCount}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      disabled={(date) => isBefore(date, new Date())}
      className="rounded-md border"
      components={{
        DayContent: ({ date }) => getDayContent(date)
      }}
    />
  );
};