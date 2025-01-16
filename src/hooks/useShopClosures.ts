import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ShopClosure {
  id: string;
  date: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export const useShopClosures = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["shop-closures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_closures")
        .select("*")
        .order("date", { ascending: true });

      if (error) throw error;
      return data as ShopClosure[];
    },
  });

  const addClosure = useMutation({
    mutationFn: async ({ date, reason }: { date: string; reason?: string | null }) => {
      const { data, error } = await supabase
        .from("shop_closures")
        .insert([{ date, reason }])
        .select()
        .single();

      if (error) {
        if (error.code === "42501") {
          throw new Error("管理者権限がありません");
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-closures"] });
      toast.success("休業日を追加しました");
    },
    onError: (error: Error) => {
      console.error("Error adding closure:", error);
      toast.error(error.message || "休業日の追加に失敗しました");
    },
  });

  const deleteClosure = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("shop_closures")
        .delete()
        .eq("id", id);

      if (error) {
        if (error.code === "42501") {
          throw new Error("管理者権限がありません");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-closures"] });
      toast.success("休業日を削除しました");
    },
    onError: (error: Error) => {
      console.error("Error deleting closure:", error);
      toast.error(error.message || "休業日の削除に失敗しました");
    },
  });

  return {
    closures: data,
    isLoading,
    error,
    addClosure,
    deleteClosure,
  };
};