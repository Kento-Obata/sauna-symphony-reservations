import { Calendar } from "@/components/ui/calendar";
import { isBefore, format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { ja } from 'date-fns/locale';
import { ReservationStatus } from "@/components/ReservationStatus";
import { Reservation } from "@/types/reservation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ReservationCalendarProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  reservations: Reservation[] | undefined;
}

const TIME_SLOTS = {
  morning: "午前",
  afternoon: "午後",
  evening: "夜",
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
            {Object.entries(TIME_SLOTS).map(([slot, label]) => (
              <TableRow key={slot}>
                <TableCell className="font-medium">{label}</TableCell>
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