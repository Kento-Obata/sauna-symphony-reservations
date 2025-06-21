
export interface CustomerStats {
  user_key: string;
  phone: string;
  latest_name: string | null;
  latest_email: string | null;
  total_reservations: number;
  completed_reservations: number;
  cancelled_reservations: number;
  last_visit_date: string | null;
  first_visit_date: string | null;
  last_reservation_created: string;
}

export interface CustomerSearchResult {
  user_key: string;
  phone: string;
  guest_name: string;
  email: string | null;
  date: string;
  status: string;
  total_price: number;
  admin_memo: string | null;
  created_at: string;
  reservation_id: string;
}
