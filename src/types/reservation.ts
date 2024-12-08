import { Database } from "@/integrations/supabase/types";

export type TimeSlot = Database["public"]["Enums"]["time_slot"];

export interface ReservationFormData {
  date: string;
  time_slot: TimeSlot;
  guest_name: string;
  guest_count: number;
  email: string | null;
  phone: string;
  water_temperature: number;
}

// Add the Reservation type export
export interface Reservation extends ReservationFormData {
  id: string;
  created_at: string;
}