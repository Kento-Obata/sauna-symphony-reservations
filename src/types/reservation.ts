
export type TimeSlot = "morning" | "afternoon" | "evening";

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
