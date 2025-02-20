
import { supabase } from "@/integrations/supabase/client";
import { PriceSetting } from "@/types/price";

// 水温による追加料金の計算
export const getSurcharge = (temp: string): number => {
  if (temp === "5-10") return 5000;
  if (temp === "10-14") return 3000;
  return 0;
};

// プレオープン期間（2025年3月）かどうかを判定
const isPreOpeningPeriod = (date: Date): boolean => {
  console.log('Checking pre-opening period for date:', date);
  return date.getFullYear() === 2025 && date.getMonth() === 2; // 3月は2（0-based）
};

// 人数に応じた一人あたりの料金を計算
const getPricePerPersonRegular = (guestCount: number): number => {
  if (guestCount === 2) return 7500;
  if (guestCount === 3 || guestCount === 4) return 7000;
  if (guestCount === 5 || guestCount === 6) return 6000;
  return 7500; // デフォルト料金（2名料金）
};

export const getPricePerPerson = async (guestCount: number, date?: Date): Promise<number> => {
  // プレオープン期間の場合は一律5000円/人
  if (date && isPreOpeningPeriod(date)) {
    console.log('Pre-opening period price applied:', 5000);
    return 5000;
  }

  console.log('Regular price period');
  const pricePerPerson = getPricePerPersonRegular(guestCount);
  console.log('Price per person:', pricePerPerson);
  return pricePerPerson;
};

export const getTotalPrice = async (guestCount: number, temperature: string, date?: Date): Promise<number> => {
  console.log('Getting total price for date:', date);
  // 文字列の日付をDateオブジェクトに変換
  const dateObj = date ? new Date(date) : undefined;
  console.log('Converted date object:', dateObj);
  
  const pricePerPerson = await getPricePerPerson(guestCount, dateObj);
  console.log('Price per person:', pricePerPerson);
  
  const basePrice = pricePerPerson * guestCount;
  const surcharge = getSurcharge(temperature);
  console.log('Base price:', basePrice, 'Surcharge:', surcharge);
  
  return basePrice + surcharge;
};

export const formatPrice = (price: number): string => {
  return `¥${price.toLocaleString()}`;
};
