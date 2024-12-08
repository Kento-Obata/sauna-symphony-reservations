import { useState } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addWeeks,
  subWeeks,
  isSameDay,
} from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TIME_SLOTS } from "@/components/TimeSlotSelect";
import { Reservation } from "@/types/reservation";
import { AdminReservationDialog } from "./AdminReservationDialog";

interface AdminCalendarProps {
  reservations?: Reservation[];
}

export const AdminCalendar = ({ reservations = [] }: AdminCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [showReservationDialog, setShowReservationDialog] = useState(false);

  const start = startOfWeek(currentDate, { weekStartsOn: 1 });
  const end = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

  const getReservationsForDateAndSlot = (date: Date, timeSlot: string) => {
    return reservations.filter(
      (r) => r.date === format(date, "yyyy-MM-dd") && r.time_slot === timeSlot
    );
  };

  const handleCellClick = (date: Date, timeSlot: string) => {
    setSelectedDate(date);
    setSelectedTimeSlot(timeSlot);
    setShowReservationDialog(true);
  };

  const getStatusDisplay = (reservations: Reservation[]) => {
    if (reservations.length === 0) {
      return <span className="text-green-500">○</span>;
    }
    const totalGuests = reservations.reduce((sum, res) => sum + res.guest_count, 0);
    return <span className={getStatusColor(totalGuests)}>{totalGuests}名</span>;
  };

  const getStatusColor = (guestCount: number) => {
    if (guestCount === 0) return "text-green-500";
    if (guestCount < 6) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="bg-white dark:bg-sauna-charcoal rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <Button variant="outline" size="icon" onClick={handlePrevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-black dark:text-white">
          {format(start, "yyyy年MM月dd日", { locale: ja })} -{" "}
          {format(end, "MM月dd日", { locale: ja })}
        </h2>
        <Button variant="outline" size="icon" onClick={handleNextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-8 gap-2">
        <div className="col-span-1"></div>
        {days.map((day) => (
          <div
            key={day.toString()}
            className="col-span-1 text-center font-medium p-2 text-black dark:text-white"
          >
            {format(day, "M/d")}
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {format(day, "E", { locale: ja })}
            </div>
          </div>
        ))}

        {Object.entries(TIME_SLOTS).map(([slot, time]) => (
          <>
            <div
              key={`time-${slot}`}
              className="col-span-1 p-2 text-sm text-right text-gray-600 dark:text-gray-300"
            >
              {time.start}
            </div>
            {days.map((day) => {
              const slotReservations = getReservationsForDateAndSlot(day, slot);
              return (
                <button
                  key={`${day}-${slot}`}
                  onClick={() => handleCellClick(day, slot)}
                  className={`col-span-1 p-2 border rounded hover:bg-gray-50 transition-colors
                    ${
                      isSameDay(day, selectedDate) && selectedTimeSlot === slot
                        ? "ring-2 ring-primary"
                        : ""
                    }
                  `}
                >
                  {getStatusDisplay(slotReservations)}
                </button>
              );
            })}
          </>
        ))}
      </div>

      <AdminReservationDialog
        open={showReservationDialog}
        onOpenChange={setShowReservationDialog}
        defaultDate={selectedDate}
        defaultTimeSlot={selectedTimeSlot as any}
      />
    </div>
  );
};