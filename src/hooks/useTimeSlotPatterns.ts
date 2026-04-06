import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TimeSlotPattern {
  id: string;
  name: string;
  morning_start: string;
  morning_end: string;
  afternoon_start: string;
  afternoon_end: string;
  evening_start: string;
  evening_end: string;
  created_at: string;
  updated_at: string;
}

export const useTimeSlotPatterns = () => {
  return useQuery({
    queryKey: ["time_slot_patterns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_slot_patterns")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as TimeSlotPattern[];
    },
  });
};

export const useCreateTimeSlotPattern = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pattern: Omit<TimeSlotPattern, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("time_slot_patterns")
        .insert(pattern)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time_slot_patterns"] });
      toast.success("パターンを作成しました");
    },
    onError: () => toast.error("パターンの作成に失敗しました"),
  });
};

export const useUpdateTimeSlotPattern = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TimeSlotPattern> }) => {
      const { data, error } = await supabase
        .from("time_slot_patterns")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time_slot_patterns"] });
      toast.success("パターンを更新しました");
    },
    onError: () => toast.error("パターンの更新に失敗しました"),
  });
};

export const useDeleteTimeSlotPattern = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("time_slot_patterns")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time_slot_patterns"] });
      toast.success("パターンを削除しました");
    },
    onError: () => toast.error("パターンの削除に失敗しました"),
  });
};
