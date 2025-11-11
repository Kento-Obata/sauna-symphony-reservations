
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Reservation } from "@/types/reservation";

export const useReservations = () => {
  return useQuery({
    queryKey: ["reservations"],
    queryFn: async () => {
      // Use edge function to get availability (no personal info)
      const { data, error } = await supabase.functions.invoke('get-availability');

      if (error) {
        console.error("Error fetching availability:", error);
        throw error;
      }

      if (data?.error) {
        console.error("Availability error:", data.error);
        throw new Error(data.error);
      }

      // Return only date, time_slot, and status for availability checking
      return data.availability as Pick<Reservation, 'date' | 'time_slot' | 'status'>[];
    },
  });
};
