// パブリックイベント予約(共有・定員制)の型。
// PublicEvent / PublicEventSlot は get-event edge function のレスポンス形。

export interface PublicEvent {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  venue: string | null;
  price_per_person: number;
  price_note: string | null;
  max_guests_per_reservation: number;
}

export interface PublicEventSlot {
  id: string;
  date: string;        // "YYYY-MM-DD"
  start_time: string;  // "HH:MM:SS"
  end_time: string;
  capacity: number;
  remaining: number;   // サーバ側で greatest(capacity - 予約済, 0) に丸め済み
}

// get-event-reservation edge function のレスポンス形（access_token は含まれない）
export interface EventReservationDetails {
  id: string;
  guest_name: string;
  guest_count: number;
  email: string;
  phone: string;
  status: "confirmed" | "cancelled";
  reservation_code: string;
  total_price: number;
  payment_status: string;
  created_at: string;
  cancelled_at: string | null;
  date: string;
  start_time: string;
  end_time: string;
  event_title: string;
  event_slug: string;
  event_venue: string | null;
  price_note: string | null;
}
