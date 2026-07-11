import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicEvent, PublicEventSlot } from "@/types/event";

interface EventWithSlots {
  event: PublicEvent;
  slots: PublicEventSlot[];
}

/**
 * edge function の非2xxレスポンス（FunctionsHttpError）からサーバの
 * エラーメッセージ（{ error: "..." }）を取り出す。取れなければ null。
 */
export const extractFunctionErrorMessage = async (error: unknown): Promise<string | null> => {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === "string") return body.error;
    } catch {
      // JSON でないレスポンスは無視
    }
  }
  return null;
};

/** 公開イベント詳細 + 枠ごとの残席（get-event edge function 経由） */
export const useEvent = (slug: string | undefined) => {
  return useQuery<EventWithSlots>({
    queryKey: ["event", slug],
    enabled: !!slug,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-event", {
        body: { slug },
      });
      if (error) {
        const message = await extractFunctionErrorMessage(error);
        throw new Error(message || "イベント情報の取得に失敗しました");
      }
      if (data?.error) throw new Error(data.error);
      return data as EventWithSlots;
    },
  });
};

export interface EventListItem {
  slug: string;
  title: string;
  description: string | null;
  venue: string | null;
  price_per_person: number;
  price_note: string | null;
  event_slots: { date: string }[];
}

/** 公開中イベントの一覧（RLS が published のイベント + active な枠のみに絞る） */
export const useEventList = () => {
  return useQuery<EventListItem[]>({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("slug, title, description, venue, price_per_person, price_note, event_slots(date)")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventListItem[];
    },
  });
};
