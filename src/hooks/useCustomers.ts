
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CustomerStats, CustomerSearchResult } from "@/types/customer";

export const useCustomerStats = () => {
  return useQuery({
    queryKey: ["customerStats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_reservation_stats")
        .select("*");

      if (error) throw error;
      return data as CustomerStats[];
    },
  });
};

export const useCustomerSearch = (searchQuery?: string) => {
  return useQuery({
    queryKey: ["customerSearch", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("customer_search")
        .select("*");

      if (searchQuery) {
        query = query.or(`phone.ilike.%${searchQuery}%,guest_name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data as CustomerSearchResult[];
    },
    enabled: !!searchQuery,
  });
};

export const useCustomerReservations = (userKey: string) => {
  return useQuery({
    queryKey: ["customerReservations", userKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_search")
        .select("*")
        .eq("user_key", userKey)
        .order('date', { ascending: false });

      if (error) throw error;
      return data as CustomerSearchResult[];
    },
    enabled: !!userKey,
  });
};
