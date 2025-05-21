
import { format, addDays, startOfWeek } from "date-fns";
import { ja } from "date-fns/locale";
import { Reservation, TimeSlot } from "@/types/reservation";
import { isShopClosed } from "./dateUtils";
import { TIME_SLOTS } from "@/components/TimeSlotSelect";
import type { ShopClosure } from "@/types/reservation";

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

// 指定された日付の時間枠が予約で埋まっているか、休枠かをチェック
export const isTimeSlotOccupied = (
  date: Date,
  timeSlot: TimeSlot,
  reservations: Reservation[]
) => {
  const slotReservations = getReservationsForDateAndSlot(date, timeSlot, reservations);
  // 休枠は "休枠" という名前の予約として保存されています
  return slotReservations.length > 0;
};

// 指定された日付の利用可能な時間枠を返す
export const getAvailableTimeSlotsForDate = (
  date: Date, 
  reservations: Reservation[], 
  shopClosures?: ShopClosure[]
): TimeSlot[] => {
  // ショップが休業日ならば、空の配列を返す
  if (isShopClosed(date, shopClosures)) {
    return [];
  }
  
  // 利用可能な時間枠をフィルタリング
  return (Object.keys(TIME_SLOTS) as TimeSlot[]).filter(
    (slot) => !isTimeSlotOccupied(date, slot, reservations)
  );
};

// 指定された週の空き枠情報をSNS投稿用のテキストフォーマットで生成
export const generateAvailabilityText = (
  weekStartDate: Date, 
  reservations: Reservation[], 
  shopClosures?: ShopClosure[]
): string => {
  let result = "";
  
  // 週の初めの日（月曜日）から各日を処理
  for (let i = 0; i < 7; i++) {
    const currentDate = addDays(weekStartDate, i);
    const dateString = format(currentDate, "M/d(E)", { locale: ja });
    
    // ショップが休業日かどうか
    if (isShopClosed(currentDate, shopClosures)) {
      result += `${dateString} 定休\n`;
      continue;
    }
    
    // 利用可能な時間枠を取得
    const availableTimeSlots = getAvailableTimeSlotsForDate(
      currentDate, 
      reservations, 
      shopClosures
    );
    
    // 利用可能な時間枠がない場合は「完売」
    if (availableTimeSlots.length === 0) {
      result += `${dateString} 完売\n`;
    } else {
      // 利用可能な時間枠を表示
      const timeSlotsText = availableTimeSlots
        .map((slot) => TIME_SLOTS[slot].start)
        .join(", ");
      
      result += `${dateString} ${timeSlotsText}\n`;
    }
  }
  
  return result;
};

// 特定の週の月曜日を取得
export const getMondayOfWeek = (date: Date): Date => {
  return startOfWeek(date, { weekStartsOn: 1 });
};
