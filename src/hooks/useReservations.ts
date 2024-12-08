import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useReservations = () => {
  return useQuery({
    queryKey: ["reservations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .order("date", { ascending: true })
        .order("time_slot", { ascending: true });

      if (error) {
        console.error("Error fetching reservations:", error);
        throw error;
      }
      
      console.log("Fetched Reservations:", data);
      return data || [];
    },
    retry: 1,
    meta: {
      errorMessage: "予約情報の取得に失敗しました",
      onError: (error: Error) => {
        console.error("Reservation fetch error:", error);
        toast.error("予約情報の取得に失敗しました");
      }
    }
  });
};