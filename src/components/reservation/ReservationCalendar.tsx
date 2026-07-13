import React from "react";
import { Calendar } from "@/components/ui/calendar";
import { isAfter, addMonths, format } from "date-fns";
import { getJstTodayYmd } from "@/utils/jstDate";
import { ReservationStatus } from "@/components/ReservationStatus";
import { Reservation } from "@/types/reservation";
import { useShopClosures } from "@/hooks/useShopClosures";
import { useDailyTimeSlots } from "@/hooks/useDailyTimeSlots";
import { getMaxSlotsForDate } from "@/utils/timeSlotRules";

interface ReservationCalendarProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  reservations: Pick<Reservation, 'date' | 'time_slot' | 'status'>[] | undefined;
}

export const ReservationCalendar = ({
  date,
  setDate,
  reservations,
}: ReservationCalendarProps) => {
  const threeMonthsFromNow = addMonths(new Date(), 3);
  const { closures: shopClosures } = useShopClosures();
  const { data: dailyTimeSlots } = useDailyTimeSlots();

  // 当日予約はフォームでは受け付けない(Instagram DM 案内の運用)ため、
  // JST の暦日文字列で比較して今日以前を選択不可にする(端末タイムゾーン非依存)
  const isOnOrBeforeJstToday = (day: Date) =>
    format(day, "yyyy-MM-dd") <= getJstTodayYmd();

  const isDateClosed = (day: Date) => {
    const dateString = format(day, 'yyyy-MM-dd');
    return shopClosures?.some(closure => closure.date === dateString);
  };

  const getDayContent = (day: Date) => {
    if (
      !reservations ||
      isOnOrBeforeJstToday(day) ||
      isAfter(day, threeMonthsFromNow)
    ) return null;

    const dateString = format(day, 'yyyy-MM-dd');
    const dateReservations = reservations.filter(
      (r) => r.date === dateString && (r.status === "confirmed" || r.status === "pending")
    );

    const reservationCount = dateReservations.length;
    const maxSlots = getMaxSlotsForDate(day, dailyTimeSlots ?? []);

    return (
      <div className="w-full h-full flex flex-col items-center justify-start pt-0.5 border-b-[1px] border-sauna-stone/50">
        <span>{day.getDate()}</span>
        <div className="text-xs translate-y-[-2px]">
          <ReservationStatus
            reservationCount={reservationCount}
            isClosed={isDateClosed(day)}
            maxReservations={maxSlots}
          />
        </div>
      </div>
    );
  };

  const isDateDisabled = (day: Date) => {
    if (
      isOnOrBeforeJstToday(day) ||
      isAfter(day, threeMonthsFromNow) ||
      isDateClosed(day)
    ) return true;

    if (!reservations) return false;

    const dateString = format(day, 'yyyy-MM-dd');
    const dateReservations = reservations.filter(
      (r) => r.date === dateString && (r.status === "confirmed" || r.status === "pending")
    );

    const maxSlots = getMaxSlotsForDate(day, dailyTimeSlots ?? []);
    return dateReservations.length >= maxSlots;
  };

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      disabled={isDateDisabled}
      className="rounded-md border"
      components={{
        DayContent: ({ date }) => getDayContent(date)
      }}
    />
  );
};
