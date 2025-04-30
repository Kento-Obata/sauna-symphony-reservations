
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Option } from "@/types/option";

export const useOptions = () => {
  return useQuery({
    queryKey: ["options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("options")
        .select("*")
        .eq("is_active", true)
        .order("price_per_person", { ascending: true });

      if (error) {
        console.error("Error fetching options:", error);
        throw error;
      }

      return data as Option[];
    },
  });
};
