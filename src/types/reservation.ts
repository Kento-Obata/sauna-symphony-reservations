export type TimeSlot = "morning" | "afternoon" | "evening" | "night";

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
