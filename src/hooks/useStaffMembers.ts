import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useStaffMembers = () =>
  useQuery({
    queryKey: ["task-staff-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username")
        .in("role", ["staff", "admin"])
        .not("username", "is", null)
        .order("username");

      if (error) throw error;
      return data;
    },
  });
