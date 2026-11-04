import type { Option } from "./option";

export type TimeSlot = "morning" | "afternoon" | "evening" | "night";

/** お客様向け API(get-reservation-by-code)が返すオプションの明細 */
export interface ReservationOptionLine {
  option: Option;
  quantity: number;
  total_price?: number | null;
}

export interface Reservation {
  id: string;
  date: string;
  time_slot: TimeSlot;
  guest_name: string;
  guest_count: number;
  email: string | null;
  phone: string;
  water_temperature: number;
  created_at: string;
  reservation_code: string | null;
  status: string;
  is_confirmed: boolean | null;
  confirmation_token: string | null;
  expires_at: string | null;
  total_price: number;
  // 予約枠の実時刻(JST, "HH:MM:SS")。作成時に DB トリガーが確定。表示はこれを使い、time_slot から計算しない
  start_time: string;
  end_time: string;
  // Square 事前決済(未設定の旧データ・キャッシュを考慮して optional)
  payment_method?: string;
  payment_status?: string;
  admin_memo?: string | null;
  admin_memo_updated_at?: string | null;
  admin_memo_updated_by?: string | null;
  // ハーブ蒸し(null = 機能導入前の予約)。中身は予約時点のスナップショット(src/utils/herbs.ts)
  herb_choice?: string | null;
  herb_selection?: unknown;
  herb_updated_at?: string | null;
  herb_updated_by?: string | null;
  // get-reservation-by-code のみが返す(管理画面の一覧には含まれない)
  options?: ReservationOptionLine[];
}

export interface ReservationFormData {
  date: string;
  time_slot: TimeSlot;
  guest_name: string;
  guest_count: number;
  email: string | null;
  phone: string;
  water_temperature: number;
  options?: {
    option_id: string;
    quantity: number;
  }[];
}

export interface ShopClosure {
  id: string;
  date: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
}
