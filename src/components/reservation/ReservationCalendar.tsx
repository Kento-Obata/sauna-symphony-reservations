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
    if (
      !reservations || 
      isBefore(day, today) || 
      isAfter(day, threeMonthsFromNow)
    ) return null;

    const dateString = format(day, 'yyyy-MM-dd');
    const dateReservations = reservations.filter(
      (r) => r.date === dateString && (r.status === "confirmed" || r.status === "pending")
    );

    const reservationCount = dateReservations.length;
    
    return (
      <div className="w-full h-full flex flex-col items-center justify-start pt-0.5">
        <span>{day.getDate()}</span>
        <ReservationStatus reservationCount={reservationCount} />
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
      className="rounded-md bg-sauna-stone/10"
      classNames={{
        months: "space-y-4",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium text-sauna-charcoal",
        nav: "space-x-1 flex items-center",
        nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 transition-opacity",
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-sauna-charcoal rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "text-center text-sm relative p-0 rounded-md focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-sauna-stone/20",
        day: "h-9 w-9 p-0 font-normal text-sauna-charcoal aria-selected:opacity-100 hover:bg-sauna-stone/20 transition-colors",
        day_selected: "bg-sauna-stone text-sauna-charcoal hover:bg-sauna-stone hover:text-sauna-charcoal focus:bg-sauna-stone focus:text-sauna-charcoal",
        day_today: "bg-sauna-accent text-white",
        day_outside: "text-sauna-stone/50 opacity-50 aria-selected:bg-sauna-stone/50 aria-selected:text-sauna-charcoal aria-selected:opacity-30",
        day_disabled: "text-sauna-stone/30 opacity-50 hover:bg-transparent",
        day_range_middle: "aria-selected:bg-sauna-stone/20 aria-selected:text-sauna-charcoal",
        day_hidden: "invisible",
      }}
      components={{
        DayContent: ({ date }) => getDayContent(date)
      }}
    />
  );
};