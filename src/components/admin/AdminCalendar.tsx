import { useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  format,
  addMonths,
  subMonths,
  isSameDay,
  parseISO,
} from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TIME_SLOTS } from "@/components/TimeSlotSelect";
import { Reservation } from "@/types/reservation";
import { AdminReservationDialog } from "./AdminReservationDialog";
import { AdminReservationDetailsDialog } from "./AdminReservationDetailsDialog";
import { useCalendarDates } from "@/hooks/useCalendarDates";

interface AdminCalendarProps {
  reservations?: Reservation[];
  onDateSelect?: (date: Date) => void;
}

export const AdminCalendar = ({ 
  reservations = [], 
  onDateSelect 
}: AdminCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [showReservationDialog, setShowReservationDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  // 月の最初の日と最後の日を取得
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // カレンダーデータを取得
  const { data: calendarDates } = useCalendarDates(monthStart, monthEnd);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const getReservationsForDateAndSlot = (date: Date, timeSlot: string) => {
    return reservations.filter(
      (r) => 
        r.date === format(date, "yyyy-MM-dd") && 
        r.time_slot === timeSlot &&
        (r.status === "confirmed" || r.status === "pending")
    );
  };

  const handleCellClick = (date: Date, timeSlot: string) => {
    const slotReservations = getReservationsForDateAndSlot(date, timeSlot);
    if (slotReservations.length === 1) {
      setSelectedReservation(slotReservations[0]);
      setShowDetailsDialog(true);
    } else {
      setSelectedDate(date);
      setSelectedTimeSlot(timeSlot);
      setShowReservationDialog(true);
    }
    if (onDateSelect) {
      onDateSelect(date);
    }
  };

  const handleDayClick = (date: Date) => {
    if (onDateSelect) {
      onDateSelect(date);
    }
  };

  const getStatusDisplay = (reservations: Reservation[]) => {
    if (reservations.length === 0) {
      return <span className="text-green-500">○</span>;
    }

    const confirmedReservations = reservations.filter(r => r.status === "confirmed");
    const pendingReservations = reservations.filter(r => r.status === "pending");
    
    const totalConfirmedGuests = confirmedReservations.reduce((sum, res) => sum + res.guest_count, 0);
    const totalPendingGuests = pendingReservations.reduce((sum, res) => sum + res.guest_count, 0);

    return (
      <div className="flex flex-col items-center text-sm">
        {totalConfirmedGuests > 0 && (
          <span className={getStatusColor(totalConfirmedGuests)}>
            {totalConfirmedGuests}名
          </span>
        )}
        {totalPendingGuests > 0 && (
          <span className="text-yellow-500 italic">
            ({totalPendingGuests}名)
          </span>
        )}
      </div>
    );
  };

  const getStatusColor = (guestCount: number) => {
    if (guestCount === 0) return "text-green-500";
    if (guestCount < 6) return "text-yellow-500";
    return "text-red-500";
  };

  if (!calendarDates) return null;

  return (
    <div className="bg-white dark:bg-sauna-charcoal rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <Button variant="outline" size="icon" onClick={handlePrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-black dark:text-white">
          {format(currentDate, "yyyy年MM月", { locale: ja })}
        </h2>
        <Button variant="outline" size="icon" onClick={handleNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-8 gap-2">
        <div className="col-span-1"></div>
        {["日", "月", "火", "水", "木", "金", "土"].map((day) => (
          <div key={day} className="col-span-1 text-center font-medium p-2">
            {day}
          </div>
        ))}

        {calendarDates.map((calendarDate) => {
          const date = parseISO(calendarDate.date);
          const dayOfWeek = calendarDate.day_of_week;
          
          // 最初の日の前に必要な空のセルを追加
          if (date.getDate() === 1) {
            const emptyCells = Array(dayOfWeek).fill(null);
            return [
              ...emptyCells.map((_, index) => (
                <div key={`empty-${index}`} className="col-span-1" />
              )),
              <button
                key={calendarDate.date}
                onClick={() => handleDayClick(date)}
                className="col-span-1 text-center font-medium p-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              >
                {format(date, "d")}
              </button>
            ];
          }

          return (
            <button
              key={calendarDate.date}
              onClick={() => handleDayClick(date)}
              className="col-span-1 text-center font-medium p-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              {format(date, "d")}
            </button>
          );
        })}

        {Object.entries(TIME_SLOTS).map(([slot, time]) => (
          <>
            <div
              key={`time-${slot}`}
              className="col-span-1 p-2 text-sm text-right text-gray-600 dark:text-gray-300"
            >
              {time.start}
            </div>
            {calendarDates.map((calendarDate) => {
              const date = parseISO(calendarDate.date);
              const slotReservations = getReservationsForDateAndSlot(date, slot);
              return (
                <button
                  key={`${calendarDate.date}-${slot}`}
                  onClick={() => handleCellClick(date, slot)}
                  className={`col-span-1 p-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                    ${
                      selectedDate && isSameDay(date, selectedDate) && selectedTimeSlot === slot
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

      <AdminReservationDetailsDialog
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        reservation={selectedReservation}
      />
    </div>
  );
};