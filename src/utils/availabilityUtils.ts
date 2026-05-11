
import { format, addDays, startOfWeek } from "date-fns";
import { ja } from "date-fns/locale";
import { Reservation, TimeSlot } from "@/types/reservation";
import { isShopClosed } from "./dateUtils";
import { TIME_SLOTS, ALL_TIME_SLOT_DEFAULTS } from "@/components/TimeSlotSelect";
import type { ShopClosure } from "@/types/reservation";
import { shouldApplyDefault4Slot } from "./timeSlotRules";

interface DailyTimeSlotRow {
  date: string;
  time_slot: TimeSlot;
  is_active: boolean;
  start_time?: string;
  end_time?: string;
}

// 指定された日付と時間枠の予約を取得する
export const getReservationsForDateAndSlot = (
  date: Date,
  timeSlot: TimeSlot,
  reservations: Reservation[]
) => {
  const dateString = format(date, "yyyy-MM-dd");
  return reservations.filter(
    (r) =>
      r.date === dateString &&
      r.time_slot === timeSlot &&
      (r.status === "confirmed" || r.status === "pending")
  );
};

export const isTimeSlotOccupied = (
  date: Date,
  timeSlot: TimeSlot,
  reservations: Reservation[]
) => {
  const slotReservations = getReservationsForDateAndSlot(date, timeSlot, reservations);
  return slotReservations.length > 0;
};

// その日に表示すべき時間枠
//  - 明示的に night 行が active なら 4 枠
//  - そうでなくても 6/6 以降の土日祝 かつ 明示行が一切無い日は 4 枠（デフォルトルール）
//  - それ以外は 3 枠
const getApplicableSlotsForDate = (
  date: Date,
  dailyTimeSlots?: DailyTimeSlotRow[]
): TimeSlot[] => {
  const dateString = format(date, "yyyy-MM-dd");
  const base: TimeSlot[] = ["morning", "afternoon", "evening"];
  const hasExplicitNight = !!dailyTimeSlots?.some(
    (dts) => dts.date === dateString && dts.time_slot === "night" && dts.is_active
  );
  if (hasExplicitNight) return [...base, "night"];
  if (shouldApplyDefault4Slot(date, dailyTimeSlots)) return [...base, "night"];
  return base;
};

export const getAvailableTimeSlotsForDate = (
  date: Date,
  reservations: Reservation[],
  shopClosures?: ShopClosure[],
  dailyTimeSlots?: DailyTimeSlotRow[]
): TimeSlot[] => {
  if (isShopClosed(date, shopClosures)) {
    return [];
  }

  return getApplicableSlotsForDate(date, dailyTimeSlots).filter(
    (slot) => !isTimeSlotOccupied(date, slot, reservations)
  );
};

const getSlotTimeForDate = (
  slot: TimeSlot,
  date: Date,
  dailyTimeSlots?: DailyTimeSlotRow[]
) => {
  const dateString = format(date, "yyyy-MM-dd");
  const dailySlot = dailyTimeSlots?.find(
    (dts) => dts.date === dateString && dts.time_slot === slot && dts.is_active
  );
  if (dailySlot?.start_time && dailySlot?.end_time) {
    return { start: dailySlot.start_time.slice(0, 5), end: dailySlot.end_time.slice(0, 5) };
  }
  return ALL_TIME_SLOT_DEFAULTS[slot];
};

export const generateAvailabilityText = (
  weekStartDate: Date,
  reservations: Reservation[],
  shopClosures?: ShopClosure[],
  dailyTimeSlots?: DailyTimeSlotRow[]
): string => {
  let result = "";

  for (let i = 0; i < 7; i++) {
    const currentDate = addDays(weekStartDate, i);
    const dateString = format(currentDate, "M/d(E)", { locale: ja });

    if (isShopClosed(currentDate, shopClosures)) {
      result += `${dateString} 定休\n`;
      continue;
    }

    const availableTimeSlots = getAvailableTimeSlotsForDate(
      currentDate,
      reservations,
      shopClosures,
      dailyTimeSlots
    );

    if (availableTimeSlots.length === 0) {
      result += `${dateString} 完売\n`;
    } else {
      const timeSlotsText = availableTimeSlots
        .map((slot) => {
          const t = getSlotTimeForDate(slot, currentDate, dailyTimeSlots);
          return `${t.start}-${t.end}`;
        })
        .join(", ");

      result += `${dateString} ${timeSlotsText}\n`;
    }
  }

  return result;
};

export const getMondayOfWeek = (date: Date): Date => {
  return startOfWeek(date, { weekStartsOn: 1 });
};
