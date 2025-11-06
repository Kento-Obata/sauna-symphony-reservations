
import { supabase } from "@/integrations/supabase/client";
import { PriceSetting } from "@/types/price";
import { Option, ReservationOption } from "@/types/option";

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

// データベースから料金設定を取得
export const fetchPriceSettings = async (): Promise<PriceSetting[]> => {
  const { data, error } = await supabase
    .from("price_settings")
    .select("*")
    .order("guest_count");

  if (error) {
    console.error("Error fetching price settings:", error);
    return [];
  }

  return data || [];
};

// オプション情報を取得する
export const fetchOptions = async (): Promise<Option[]> => {
  const { data, error } = await supabase
    .from("options")
    .select("*")
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching options:", error);
    return [];
  }

  return data || [];
};

// 個別オプションの合計金額を計算
export const calculateOptionTotalPrice = (
  option: Option,
  quantity: number,
  guestCount: number
): number => {
  if (option.pricing_type === 'flat') {
    // 一律料金の場合
    return option.flat_price || 0;
  } else if (option.pricing_type === 'per_guest') {
    // 予約人数に自動適用される料金の場合
    return option.price_per_person * guestCount;
  } else {
    // 一人あたり料金（数量選択可能）の場合
    const effectiveQuantity = Math.min(quantity, guestCount);
    return option.price_per_person * effectiveQuantity;
  }
};

// 選択されたオプションの合計金額を計算（後方互換性のために維持）
export const calculateOptionsTotal = async (
  selectedOptions: ReservationOption[] = []
): Promise<number> => {
  if (!selectedOptions || selectedOptions.length === 0) return 0;

  try {
    const options = await fetchOptions();
    return selectedOptions.reduce((total, selectedOption) => {
      const option = options.find(o => o.id === selectedOption.option_id);
      if (option) {
        // pricing_typeに応じた計算
        if (option.pricing_type === 'flat') {
          return total + (option.flat_price || 0);
        } else if (option.pricing_type === 'per_guest') {
          // per_guestの場合はquantityが予約人数（selectedOption.quantityを使用）
          return total + (option.price_per_person * selectedOption.quantity);
        } else {
          return total + (option.price_per_person * selectedOption.quantity);
        }
      }
      return total;
    }, 0);
  } catch (error) {
    console.error("オプション料金計算エラー:", error);
    return 0;
  }
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

  // 通常期間の場合はデータベースから料金を取得
  try {
    const priceSettings = await fetchPriceSettings();
    const setting = priceSettings.find(p => p.guest_count === guestCount);
    
    if (setting) {
      console.log(`Price from database for ${guestCount} guests:`, setting.price_per_person);
      return setting.price_per_person;
    }
  } catch (error) {
    console.error("Error getting price from database:", error);
  }

  // データベースから取得できない場合はデフォルト値を使用
  console.log('Using default pricing logic');
  const pricePerPerson = getPricePerPersonRegular(guestCount);
  console.log('Price per person:', pricePerPerson);
  return pricePerPerson;
};

export const getTotalPrice = async (
  guestCount: number, 
  temperature: string, 
  date?: Date,
  selectedOptions: ReservationOption[] = []
): Promise<number> => {
  console.log('Getting total price for date:', date);
  // 文字列の日付をDateオブジェクトに変換
  const dateObj = date ? new Date(date) : undefined;
  console.log('Converted date object:', dateObj);
  
  const pricePerPerson = await getPricePerPerson(guestCount, dateObj);
  console.log('Price per person:', pricePerPerson);
  
  const basePrice = pricePerPerson * guestCount;
  // 水温機能は2025年9月から導入のため、サーチャージは常に0円
  const surcharge = 0;
  
  // オプション料金を計算
  const optionsTotal = await calculateOptionsTotal(selectedOptions);
  
  console.log('Base price:', basePrice, 'Surcharge:', surcharge, 'Options total:', optionsTotal);
  
  return basePrice + surcharge + optionsTotal;
};

export const formatPrice = (price: number): string => {
  return `¥${price.toLocaleString()}`;
};
