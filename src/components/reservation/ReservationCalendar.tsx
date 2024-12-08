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
      <div className="w-full h-full flex flex-col items-center border-b border-secondary/30 pb-1">
        <span className="text-sm mb-1">{day.getDate()}</span>
        <div className="text-xs">
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
      styles={{
        head_cell: "h-14 sm:h-16",
        cell: "h-14 sm:h-16 p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: "h-14 sm:h-16 w-full p-0 font-normal aria-selected:opacity-100",
        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        nav: "space-x-1 flex items-center",
        nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        row: "flex w-full mt-2",
        head: "text-muted-foreground font-normal text-[0.8rem]",
        caption: "relative pt-1 items-center",
        caption_label: "text-sm font-medium",
      }}
    />
  );
};