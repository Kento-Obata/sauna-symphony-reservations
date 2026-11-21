// イベント当日のオプション記録・会計。データは event_tab_* の RPC で読み書きする。
// token はスタッフ用リンクのトークン。管理画面ではログイン中の管理者として null を渡す。
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface EventTabItem {
  id: string;
  name: string;
  price: number;
}

export interface EventTabLine {
  item_id: string;
  quantity: number;
  unit_price: number;
}

export interface EventTabGuest {
  /** 予約は "r:<予約id>"、飛び込みは "t:<会計id>" */
  key: string;
  reservation_id: string | null;
  tab_id: string | null;
  guest_name: string;
  guest_count: number | null;
  reservation_code: string | null;
  payment_status: "unpaid" | "paid" | "refunded" | null;
  payment_method: string | null;
  total_price: number | null;
  slot_id: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  settled_at: string | null;
  settled_amount: number | null;
  lines: EventTabLine[];
}

export interface EventTabSlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
}

export interface EventTabBoardData {
  is_admin: boolean;
  items: EventTabItem[];
  events: { id: string; title: string; first_date: string }[];
  event: { id: string; title: string; price_per_person: number } | null;
  slots: EventTabSlot[];
  guests: EventTabGuest[];
}

export const tabTotal = (lines: EventTabLine[]) =>
  lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);

export const formatYen = (amount: number) => `¥${amount.toLocaleString()}`;

/** 入場料の支払い状況（予約のお客さんのみ）。会計のときに入場料も受け取るかの判断に使う */
export const entryFeeLabel = (guest: EventTabGuest) => {
  if (!guest.reservation_id) return null;
  if (guest.payment_status === "paid") return "入場料は支払済み";
  if (guest.payment_status === "refunded") return "入場料は返金済み";
  if (guest.total_price && guest.total_price > 0) return `入場料 ${formatYen(guest.total_price)} は現地払い`;
  return null;
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_token: "このリンクは使えません。管理者に新しいリンクをもらってください",
  event_not_available: "このイベントは今日の前後ではないため記録できません",
  event_not_found: "イベントが見つかりません",
  tab_settled: "精算済みです。精算を取り消してから直してください",
  tab_not_found: "会計が見つかりません。画面を更新してください",
  reservation_not_found: "予約が見つかりません（キャンセルされた可能性があります）",
  item_not_found: "このオプションは今は使えません",
};

export const eventTabErrorMessage = (error: unknown, fallback: string) => {
  const message = (error as { message?: string })?.message ?? "";
  return ERROR_MESSAGES[message] ?? fallback;
};

const boardKey = (token: string | null, eventId: string | null) => ["event-tab-board", token, eventId];

export const useEventTabBoard = (token: string | null, eventId: string | null) =>
  useQuery({
    queryKey: boardKey(token, eventId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("event_tab_board", {
        p_token: token,
        p_event_id: eventId,
      });
      if (error) throw error;
      return data as unknown as EventTabBoardData;
    },
    retry: false,
    // 2台以上のスマホで同時に記録しても、ほかの端末の記録が見えるように
    refetchInterval: 15_000,
  });

/** RPC を呼んで、失敗したらトーストを出し、どちらにしても一覧を取り直す */
export const useEventTabAction = () => {
  const queryClient = useQueryClient();
  return async <T,>(
    call: () => PromiseLike<{ data: T | null; error: unknown }>,
    failure: string,
  ): Promise<T | null | undefined> => {
    try {
      const { data, error } = await call();
      if (error) {
        console.error(failure, error);
        toast.error(eventTabErrorMessage(error, failure));
        return undefined;
      }
      return data;
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["event-tab-board"] });
    }
  };
};
