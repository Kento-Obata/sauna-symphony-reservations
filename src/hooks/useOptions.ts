
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Option } from "@/types/option";

/**
 * Hook to fetch options from the database
 * @param onlyActive - If true, only fetch active options. Default is true.
 * @returns Query result with options data
 */
export const useOptions = (onlyActive = true) => {
  return useQuery({
    queryKey: ["options", { onlyActive }],
    queryFn: async () => {
      let query = supabase
        .from("options")
        .select("*");
        
      // Only filter by is_active if onlyActive is true
      if (onlyActive) {
        query = query.eq("is_active", true);
      }
      
      const { data, error } = await query.order("price_per_person", { ascending: true });

      if (error) {
        console.error("Error fetching options:", error);
        throw error;
      }

      return data as Option[];
    },
  });
};
