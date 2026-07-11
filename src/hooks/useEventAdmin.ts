import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";
import { extractFunctionErrorMessage } from "@/hooks/useEvent";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type EventInsert = Database["public"]["Tables"]["events"]["Insert"];
type EventUpdate = Database["public"]["Tables"]["events"]["Update"];
type EventSlotRow = Database["public"]["Tables"]["event_slots"]["Row"];
type EventSlotInsert = Database["public"]["Tables"]["event_slots"]["Insert"];
type EventSlotUpdate = Database["public"]["Tables"]["event_slots"]["Update"];

export interface AdminEventReservation {
  id: string;
  guest_name: string;
  guest_count: number;
  email: string;
  phone: string;
  status: string;
  reservation_code: string;
  total_price: number;
  payment_status: string;
  payment_method: string | null;
  expires_at: string | null;
  created_at: string;
  cancelled_at: string | null;
}

export type AdminEventSlot = EventSlotRow & {
  event_reservations: AdminEventReservation[];
};

export type AdminEvent = EventRow & {
  event_slots: AdminEventSlot[];
};

const ADMIN_EVENTS_KEY = ["admin-events"];

/** RLS のエラーコードを運用者向けメッセージに変換 */
const mutationErrorMessage = (error: unknown, fallback: string): string => {
  const code = (error as { code?: string })?.code;
  if (code === "42501") return "管理者権限がありません";
  if (code === "23505") return "同じ値が既に存在します（slug または同一日時の枠の重複）";
  if (code === "23503") return "予約が存在するため削除できません";
  if (code === "23514") return "入力値が制約に違反しています（slug の形式や定員の範囲を確認してください）";
  // edge function 経由の mutation が投げた日本語メッセージはそのまま表示する
  // （PostgrestError は Error インスタンスではないためここには入らない）
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

/** イベント + 枠 + 予約(人数集計・一覧用)を管理者権限でまとめて取得 */
export const useAdminEvents = () => {
  return useQuery<AdminEvent[]>({
    queryKey: ADMIN_EVENTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "*, event_slots(*, event_reservations(id, guest_name, guest_count, email, phone, status, reservation_code, total_price, payment_status, payment_method, expires_at, created_at, cancelled_at))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const events = (data ?? []) as AdminEvent[];
      // ネスト先の並びは保証されないためクライアント側で整列
      for (const event of events) {
        event.event_slots.sort((a, b) =>
          a.date === b.date
            ? a.start_time.localeCompare(b.start_time)
            : a.date.localeCompare(b.date),
        );
      }
      return events;
    },
  });
};

/** 枠の占有人数（confirmed + 期限内の決済待ち）。公開側の残席計算と同じ定義。 */
export const reservedCount = (slot: AdminEventSlot): number =>
  slot.event_reservations
    .filter(
      (reservation) =>
        reservation.status === "confirmed" ||
        (reservation.status === "pending_payment" &&
          !!reservation.expires_at &&
          new Date(reservation.expires_at).getTime() > Date.now()),
    )
    .reduce((sum, reservation) => sum + reservation.guest_count, 0);

const useEventMutation = <TVariables,>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  successMessage: string,
  failureMessage: string,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_EVENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(successMessage);
    },
    onError: (error) => {
      console.error(failureMessage, error);
      toast.error(mutationErrorMessage(error, failureMessage));
    },
  });
};

export const useCreateEvent = () =>
  useEventMutation(async (event: EventInsert) => {
    const { data, error } = await supabase.from("events").insert(event).select().single();
    if (error) throw error;
    return data;
  }, "イベントを作成しました", "イベントの作成に失敗しました");

export const useUpdateEvent = () =>
  useEventMutation(async ({ id, updates }: { id: string; updates: EventUpdate }) => {
    const { data, error } = await supabase
      .from("events")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }, "イベントを更新しました", "イベントの更新に失敗しました");

export const useDeleteEvent = () =>
  useEventMutation(async (id: string) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) throw error;
  }, "イベントを削除しました", "イベントの削除に失敗しました");

export const useCreateEventSlot = () =>
  useEventMutation(async (slot: EventSlotInsert) => {
    const { data, error } = await supabase.from("event_slots").insert(slot).select().single();
    if (error) throw error;
    return data;
  }, "枠を追加しました", "枠の追加に失敗しました");

export const useUpdateEventSlot = () =>
  useEventMutation(async ({ id, updates }: { id: string; updates: EventSlotUpdate }) => {
    const { data, error } = await supabase
      .from("event_slots")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }, "枠を更新しました", "枠の更新に失敗しました");

export const useDeleteEventSlot = () =>
  useEventMutation(async (id: string) => {
    const { error } = await supabase.from("event_slots").delete().eq("id", id);
    if (error) throw error;
  }, "枠を削除しました", "枠の削除に失敗しました");

/**
 * 管理者による予約キャンセル。
 * 直接の DB UPDATE ではなく edge function を経由する（支払い済みの場合の
 * Square 返金・決済待ちの場合の決済リンク削除・顧客メールを一括で行うため）。
 */
export const useCancelEventReservationAdmin = () =>
  useEventMutation(async (id: string) => {
    const { data, error } = await supabase.functions.invoke("admin-cancel-event-reservation", {
      body: { reservationId: id },
    });
    if (error) {
      const message = await extractFunctionErrorMessage(error);
      throw new Error(message || "予約のキャンセルに失敗しました");
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }, "予約をキャンセルしました", "予約のキャンセルに失敗しました");
