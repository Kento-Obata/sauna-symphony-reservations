import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Reservation } from "@/types/reservation";
import { getJstTodayYmd } from "@/utils/jstDate";

interface AdminReservationsRange {
  /** yyyy-MM-dd(当日を含む)。未指定なら JST の今日 = 今日以降のみ取得 */
  from?: string;
  /** yyyy-MM-dd(当日を含む)。未指定なら上限なし */
  to?: string;
}

// Admin用: 認証済みユーザーが完全な予約情報を取得
//
// 全期間を一度に取得することはできない(PostgREST の max-rows により 1000 件で
// 打ち切られ、date 昇順のため未来の予約が落ちる)。過去日を表示したい画面は
// 表示中の期間を from/to で指定して取得する。
export const useAdminReservations = (range: AdminReservationsRange = {}) => {
  const from = range.from ?? getJstTodayYmd();
  const to = range.to ?? null;

  return useQuery({
    queryKey: ["admin-reservations", from, to],
    queryFn: async () => {
      // Staff/Admin RLS policy により認証済みユーザーは全予約データにアクセス可能
      let query = supabase
        .from("reservations")
        .select("*")
        .gte('date', from)
        .in('status', ['confirmed', 'pending', 'pending_payment'])
        .order('date', { ascending: true });

      if (to) {
        query = query.lte('date', to);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Reservation[];
    },
  });
};
