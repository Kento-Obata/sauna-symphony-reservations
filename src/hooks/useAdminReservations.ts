import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Reservation } from "@/types/reservation";
import { getJstTodayYmd } from "@/utils/jstDate";

// Admin用: 認証済みユーザーが完全な予約情報を取得
export const useAdminReservations = () => {
  return useQuery({
    queryKey: ["admin-reservations"],
    queryFn: async () => {
      const today = getJstTodayYmd();
      
      // Staff/Admin RLS policy により認証済みユーザーは全予約データにアクセス可能
      const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .gte('date', today)
        .in('status', ['confirmed', 'pending', 'pending_payment'])
        .order('date', { ascending: true });

      if (error) throw error;
      return data as Reservation[];
    },
  });
};
