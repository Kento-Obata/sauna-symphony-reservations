import { Calendar } from "@/components/ui/calendar";
import { isBefore, format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from "date-fns";
import { ja } from 'date-fns/locale';
import { ReservationStatus } from "@/components/ReservationStatus";
import { Reservation } from "@/types/reservation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TIME_SLOTS } from "../TimeSlotSelect";

interface ReservationCalendarProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  reservations: Reservation[] | undefined;
}

const TIME_SLOT_LABELS = {
  morning: `10:00-12:30`,
  afternoon: `13:30-16:00`,
  evening: `17:00-19:30`,
} as const;

export const ReservationCalendar = ({
  date,
  setDate,
  reservations,
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

  const handlePreviousWeek = () => {
    setDate(subWeeks(currentDate, 1));
  };

  const handleNextWeek = () => {
    setDate(addWeeks(currentDate, 1));
  };

  return (
    <div className="space-y-4">
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        disabled={(date) => isBefore(date, new Date())}
        className="rounded-md border"
      />

      <div className="rounded-md border">
        <div className="flex items-center justify-between p-4 border-b">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePreviousWeek}
            disabled={isBefore(weekStart, new Date())}
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
                  return (
                    <TableCell key={day.toString()} className="text-center">
                      <ReservationStatus reservationCount={slotReservations.length} />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};