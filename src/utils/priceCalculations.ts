
import { supabase } from "@/integrations/supabase/client";
import { PriceSetting } from "@/types/price";

export const getSurcharge = (temp: number): number => {
  if (temp <= 7) return 5000;
  return 0;
};

let cachedPriceSettings: PriceSetting[] | null = null;

export const getPriceSettings = async (): Promise<PriceSetting[]> => {
  if (cachedPriceSettings) {
    return cachedPriceSettings;
  }

  const { data, error } = await supabase
    .from("price_settings")
    .select("*")
    .order("guest_count");

  if (error) {
    throw new Error("料金設定の取得に失敗しました");
  }

  cachedPriceSettings = data;
  return data;
};

export const getPricePerPerson = async (guestCount: number): Promise<number> => {
  const settings = await getPriceSettings();
  const setting = settings.find(s => s.guest_count === guestCount);
  return setting ? setting.price_per_person : 40000; // デフォルト価格
};

export const getTotalPrice = async (guestCount: number, waterTemperature: number): Promise<number> => {
  const pricePerPerson = await getPricePerPerson(guestCount);
  const basePrice = pricePerPerson * guestCount;
  const surcharge = getSurcharge(waterTemperature);
  return basePrice + surcharge;
};

export const formatPrice = (price: number): string => {
  return `¥${price.toLocaleString()}`;
};
