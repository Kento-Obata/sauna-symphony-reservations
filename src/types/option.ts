
export interface Option {
  id: string;
  name: string;
  description: string | null;
  pricing_type: 'per_person' | 'flat' | 'per_guest';
  price_per_person: number;
  flat_price: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReservationOption {
  option_id: string;
  quantity: number;
}
