
export interface Option {
  id: string;
  name: string;
  description: string | null;
  price_per_person: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReservationOption {
  option_id: string;
  quantity: number;
}
