import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ReservationFormData } from "@/types/reservation";

export const useReservations = () => {
  return useQuery({
    queryKey: ["reservations"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .gte('date', today)
        .order('date', { ascending: true });

      if (error) throw error;
      return data as ReservationFormData[];
    },
  });
};