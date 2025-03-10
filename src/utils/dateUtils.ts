
import { format } from "date-fns";
import type { ShopClosure } from "@/types/reservation";

export const isShopClosed = (
  date: Date | undefined,
  closures?: ShopClosure[]
): boolean => {
  if (!date || !closures || closures.length === 0) return false;
  
  const dateString = format(date, 'yyyy-MM-dd');
  return closures.some(closure => closure.date === dateString);
};
