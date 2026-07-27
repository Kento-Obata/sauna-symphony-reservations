import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Reservation } from "@/types/reservation";

/** 1回の検索で返す最大件数(超えた場合は UI で絞り込みを促す) */
export const ADMIN_SEARCH_LIMIT = 200;

const DEBOUNCE_MS = 300;

interface AdminReservationSearchParams {
  name?: string;
  phone?: string;
  /** yyyy-MM-dd */
  date?: string;
}

const useDebouncedValue = (value: string, delayMs: number) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};

// LIKE のメタ文字を入力そのままで送るとワイルドカードとして解釈されてしまうためエスケープする
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

// 検索は過去日も対象にする必要があるため、取得済みの一覧(今日以降)を絞り込むのではなく
// サーバ側で全期間を検索する。
export const useAdminReservationSearch = ({
  name,
  phone,
  date,
}: AdminReservationSearchParams) => {
  const nameQuery = name?.trim() ?? "";
  const phoneQuery = phone?.trim() ?? "";
  const dateQuery = date ?? null;

  // 1文字ごとにリクエストを飛ばさないよう、テキスト入力だけ遅延させる
  const debouncedName = useDebouncedValue(nameQuery, DEBOUNCE_MS);
  const debouncedPhone = useDebouncedValue(phoneQuery, DEBOUNCE_MS);
  const isDebouncing = debouncedName !== nameQuery || debouncedPhone !== phoneQuery;

  const { data, isFetching } = useQuery({
    queryKey: ["admin-reservations", "search", debouncedName, debouncedPhone, dateQuery],
    enabled: Boolean(debouncedName || debouncedPhone || dateQuery),
    queryFn: async () => {
      let query = supabase
        .from("reservations")
        .select("*")
        .in('status', ['confirmed', 'pending', 'pending_payment'])
        .order('date', { ascending: false })
        .limit(ADMIN_SEARCH_LIMIT);

      if (dateQuery) query = query.eq('date', dateQuery);
      if (debouncedName) query = query.ilike('guest_name', `%${escapeLike(debouncedName)}%`);
      if (debouncedPhone) query = query.ilike('phone', `%${escapeLike(debouncedPhone)}%`);

      const { data, error } = await query;

      if (error) throw error;
      return data as Reservation[];
    },
  });

  return { data, isSearching: isFetching || isDebouncing };
};
