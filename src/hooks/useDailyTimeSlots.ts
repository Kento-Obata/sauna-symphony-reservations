import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type DailyTimeSlot = Database["public"]["Tables"]["daily_time_slots"]["Row"];
type DailyTimeSlotInsert = Database["public"]["Tables"]["daily_time_slots"]["Insert"];
type DailyTimeSlotUpdate = Database["public"]["Tables"]["daily_time_slots"]["Update"];

export const useDailyTimeSlots = () => {
  return useQuery({
    queryKey: ["daily_time_slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_time_slots")
        .select("*")
        .order("date", { ascending: true })
        .order("time_slot", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
};

export const useCreateDailyTimeSlot = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (timeSlot: DailyTimeSlotInsert) => {
      const { data, error } = await supabase
        .from("daily_time_slots")
        .insert(timeSlot)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily_time_slots"] });
      toast.success("時間スロットを作成しました");
    },
    onError: (error) => {
      console.error("Error creating daily time slot:", error);
      toast.error("時間スロットの作成に失敗しました");
    },
  });
};

export const useUpdateDailyTimeSlot = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: DailyTimeSlotUpdate;
    }) => {
      const { data, error } = await supabase
        .from("daily_time_slots")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily_time_slots"] });
      toast.success("時間スロットを更新しました");
    },
    onError: (error) => {
      console.error("Error updating daily time slot:", error);
      toast.error("時間スロットの更新に失敗しました");
    },
  });
};

export const useDeleteDailyTimeSlot = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("daily_time_slots")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily_time_slots"] });
      toast.success("時間スロットを削除しました");
    },
    onError: (error) => {
      console.error("Error deleting daily time slot:", error);
      toast.error("時間スロットの削除に失敗しました");
    },
  });
};