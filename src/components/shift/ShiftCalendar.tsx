import React, { useState } from "react";
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
import { AdminReservationDetailsDialog } from "./AdminReservationDetailsDialog";
import { useShopClosures } from "@/hooks/useShopClosures";

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
  const { closures: shopClosures } = useShopClosures();

  // Changed weekStartsOn from 1 to 0 to start from Sunday
  const start = startOfWeek(currentDate, { weekStartsOn: 0 });
  const end = endOfWeek(currentDate, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

  const getReservationsForDateAndSlot = (date: Date, timeSlot: string) => {
    return reservations.filter(
      (r) => 
        r.date === format(date, "yyyy-MM-dd") && 
        r.time_slot === timeSlot &&
        (r.status === "confirmed" || r.status === "pending")
    );
  };

  const isDateClosed = (date: Date) => {
    if (!shopClosures) return false;
    const dateString = format(date, "yyyy-MM-dd");
    return shopClosures.some(closure => closure.date === dateString);
  };

  const handleCellClick = (date: Date, timeSlot: string) => {
    // Remove the isDateClosed check here to allow shift management on closed days
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

  const getStatusDisplay = (date: Date, reservations: Reservation[]) => {
    if (isDateClosed(date)) {
      return <span className="text-gray-500">休</span>;
    }

    if (reservations.length === 0) {
      return <span className="text-black">○</span>;
    }

    const totalGuests = reservations.reduce((sum, r) => sum + r.guest_count, 0);
    return <span className="text-black">{totalGuests}</span>;
  };

  return (
    <div className="bg-sauna-base dark:bg-sauna-charcoal rounded-lg shadow p-4">
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
          <button
            key={day.toString()}
            onClick={() => handleDayClick(day)}
            className="col-span-1 text-center font-medium p-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            {format(day, "M/d")}
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {format(day, "E", { locale: ja })}
            </div>
          </button>
        ))}

        {Object.entries(TIME_SLOTS).map(([slot, time]) => (
          <React.Fragment key={`time-${slot}`}>
            <div className="col-span-1 p-2 text-sm text-right text-gray-600 dark:text-gray-300">
              {time.start}
            </div>
            {days.map((day) => {
              const slotReservations = getReservationsForDateAndSlot(day, slot);
              const closed = isDateClosed(day);
              return (
                <button
                  key={`${day}-${slot}`}
                  onClick={() => handleCellClick(day, slot)}
                  className={`col-span-1 p-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                    ${closed ? 'bg-gray-50' : ''}
                    ${
                      isSameDay(day, selectedDate) && selectedTimeSlot === slot
                        ? "ring-2 ring-primary"
                        : ""
                    }
                  `}
                >
                  {getStatusDisplay(day, slotReservations)}
                </button>
              );
            })}
          </React.Fragment>
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
