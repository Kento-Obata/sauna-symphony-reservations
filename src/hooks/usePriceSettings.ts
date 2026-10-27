import { useQuery } from "@tanstack/react-query";
import { fetchPriceSettings } from "@/utils/priceCalculations";

export const usePriceSettings = () =>
  useQuery({
    queryKey: ["price-settings"],
    queryFn: fetchPriceSettings,
    staleTime: 5 * 60 * 1000,
  });
