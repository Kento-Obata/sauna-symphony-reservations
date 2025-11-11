import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Reservation } from "@/types/reservation";

// Admin用: 認証済みユーザーが完全な予約情報を取得
export const useAdminReservations = () => {
  return useQuery({
    queryKey: ["admin-reservations"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Staff/Admin RLS policy により認証済みユーザーは全予約データにアクセス可能
      const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .gte('date', today)
        .in('status', ['confirmed', 'pending'])
        .order('date', { ascending: true });

      if (error) throw error;
      return data as Reservation[];
    },
  });
};
