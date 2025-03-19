
import { supabase } from "@/integrations/supabase/client";
import { PriceSetting } from "@/types/price";

// 水温による追加料金の計算
export const getSurcharge = (temp: string): number => {
  // 水温機能は2025年9月から導入のため、現在は常に0円を返す
  return 0;
};

// プレオープン期間（2025年3月）かどうかを判定
const isPreOpeningPeriod = (date: Date): boolean => {
  console.log('Checking pre-opening period for date:', date);
  return date.getFullYear() === 2025 && date.getMonth() === 2; // 3月は2（0-based）
};

// 人数に応じた一人あたりの料金を計算
const getPricePerPersonRegular = (guestCount: number): number => {
  // 新料金体系（2024年4月以降の新規予約向け）
  // 料金はグループ全体の料金を人数で割るのではなく、グループ全体の料金を返す
  if (guestCount === 2) return 10000; // 20000円 ÷ 2人 = 10000円/人
  if (guestCount === 3) return 8000;  // 24000円 ÷ 3人 = 8000円/人
  if (guestCount === 4) return 7000;  // 28000円 ÷ 4人 = 7000円/人
  if (guestCount === 5) return 6400;  // 32000円 ÷ 5人 = 6400円/人
  if (guestCount === 6) return 6000;  // 36000円 ÷ 6人 = 6000円/人
  return 10000; // デフォルト料金（2名あたりの料金）
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
  // 水温機能は2025年9月から導入のため、サーチャージは常に0円
  const surcharge = 0;
  console.log('Base price:', basePrice, 'Surcharge:', surcharge);
  
  return basePrice + surcharge;
};

export const formatPrice = (price: number): string => {
  return `¥${price.toLocaleString()}`;
};

// グループ全体の料金を取得（管理画面表示用）
export const getGroupPrice = (guestCount: number): number => {
  if (guestCount === 2) return 20000;
  if (guestCount === 3) return 24000;
  if (guestCount === 4) return 28000;
  if (guestCount === 5) return 32000;
  if (guestCount === 6) return 36000;
  return 20000; // デフォルト料金（2名料金）
};
