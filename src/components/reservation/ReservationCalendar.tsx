import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from "date-fns";
import { ja } from 'date-fns/locale';
import { ReservationStatus } from "@/components/ReservationStatus";
import { Reservation, TimeSlot } from "@/types/reservation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TIME_SLOTS } from "../TimeSlotSelect";
import { AdminReservationDialog } from "../admin/AdminReservationDialog";

interface ReservationCalendarProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  reservations: Reservation[] | undefined;
  isAdmin?: boolean;
}

const TIME_SLOT_LABELS = {
  morning: "10:00-12:30",
  afternoon: "13:30-16:00",
  evening: "17:00-19:30",
} as const;

export const ReservationCalendar = ({
  date,
  setDate,
  reservations,
  isAdmin = false,
}: ReservationCalendarProps) => {
  const currentDate = date || new Date();
  const weekStart = startOfWeek(currentDate, { locale: ja });
  const weekEnd = endOfWeek(currentDate, { locale: ja });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getReservationsForSlot = (day: Date, timeSlot: keyof typeof TIME_SLOTS) => {
    if (!reservations) return [];
    const dateString = format(day, 'yyyy-MM-dd');
    return reservations.filter(
      (r) => r.date === dateString && r.time_slot === timeSlot
    );
  };

  const getTimeSlotReservations = (selectedDate: Date) => {
    const defaultSlotReservations: Record<TimeSlot, number> = {
      morning: 0,
      afternoon: 0,
      evening: 0
    };

    if (!reservations) return defaultSlotReservations;

    const dateString = format(selectedDate, 'yyyy-MM-dd');
    
    return reservations
      .filter(r => r.date === dateString)
      .reduce((acc, r) => {
        acc[r.time_slot] = (acc[r.time_slot] || 0) + 1;
        return acc;
      }, { ...defaultSlotReservations });
  };

  const handlePreviousWeek = () => {
    const newDate = subWeeks(currentDate, 1);
    setDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = addWeeks(currentDate, 1);
    setDate(newDate);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <div className="flex items-center justify-between p-4 border-b">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePreviousWeek}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium">
            {format(weekStart, 'yyyy年MM月dd日', { locale: ja })} - {format(weekEnd, 'MM月dd日', { locale: ja })}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNextWeek}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">時間帯</TableHead>
              {daysInWeek.map((day) => (
                <TableHead key={day.toString()} className="text-center">
                  {format(day, 'M/d (E)', { locale: ja })}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(TIME_SLOT_LABELS).map(([slot, timeRange]) => (
              <TableRow key={slot}>
                <TableCell className="font-medium">{timeRange}</TableCell>
                {daysInWeek.map((day) => {
                  const slotReservations = getReservationsForSlot(day, slot as keyof typeof TIME_SLOTS);
                  const reservationCount = slotReservations.length;
                  return (
                    <TableCell key={day.toString()} className="text-center">
                      {isAdmin ? (
                        <AdminReservationDialog
                          selectedDate={day}
                          timeSlotReservations={getTimeSlotReservations(day)}
                          initialTimeSlot={slot as TimeSlot}
                          trigger={
                            <button className="w-full h-full min-h-[40px] hover:bg-gray-50 rounded-md transition-colors">
                              <ReservationStatus reservationCount={reservationCount} />
                            </button>
                          }
                        />
                      ) : (
                        <div className="flex items-center justify-center space-x-2">
                          <ReservationStatus reservationCount={reservationCount} />
                          <span className="text-sm text-gray-600">
                            {reservationCount === 0 ? "予約可能" :
                             reservationCount < 3 ? "残りわずか" :
                             "予約不可"}
                          </span>
                        </div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {isAdmin && (
        <div className="flex justify-end">
          <AdminReservationDialog
            selectedDate={currentDate}
            timeSlotReservations={getTimeSlotReservations(currentDate)}
          />
        </div>
      )}
    </div>
  );
};