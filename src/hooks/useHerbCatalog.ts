import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { HerbCatalog } from "@/utils/herbs";

/** 予約画面・マイページ用: 有効なハーブ・ブレンド（在庫切れの判定つき）・おすすめ */
export const useHerbCatalog = () =>
  useQuery({
    queryKey: ["herb-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_herb_catalog");
      if (error) throw error;
      return data as unknown as HerbCatalog;
    },
    staleTime: 60_000,
  });
