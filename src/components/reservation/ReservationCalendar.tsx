import { Calendar } from "@/components/ui/calendar";
import { isBefore, format } from "date-fns";
import { ReservationStatus } from "@/components/ReservationStatus";
import { Reservation } from "@/types/reservation";

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
      <div className="w-full h-full flex flex-col items-center justify-start pt-1 gap-1 border-b border-sauna-charcoal/50 dark:border-gray-600">
        <span>{day.getDate()}</span>
        <div className="text-xs pb-0.5 sm:pb-1">
          <ReservationStatus reservationCount={reservationCount} />
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