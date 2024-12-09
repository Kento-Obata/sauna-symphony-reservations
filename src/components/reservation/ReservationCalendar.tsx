import { Calendar } from "@/components/ui/calendar";
import { isBefore, isAfter, addMonths, format } from "date-fns";
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
  const today = new Date();
  const threeMonthsFromNow = addMonths(today, 3);

  const getDayContent = (day: Date) => {
    // Only show reservation status for dates between today and three months from now
    if (
      !reservations || 
      isBefore(day, today) || 
      isAfter(day, threeMonthsFromNow)
    ) return null;

    const dateString = format(day, 'yyyy-MM-dd');
    const dateReservations = reservations.filter(
      (r) => r.date === dateString && r.status === "confirmed" // Only show confirmed reservations
    );

    const reservationCount = dateReservations.length;
    
    return (
      <div className="w-full h-full flex flex-col items-center justify-start pt-0.5 border-b-[1px] border-sauna-stone/50">
        <span>{day.getDate()}</span>
        <div className="text-xs translate-y-[-2px]">
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
      disabled={(date) => 
        isBefore(date, today) || 
        isAfter(date, threeMonthsFromNow)
      }
      className="rounded-md border"
      components={{
        DayContent: ({ date }) => getDayContent(date)
      }}
    />
  );
};