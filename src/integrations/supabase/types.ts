export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      approved_shifts: {
        Row: {
          created_at: string
          date: string
          end_hour: number
          id: string
          note: string | null
          shift_request_id: string
          staff_id: string
          start_hour: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          end_hour: number
          id?: string
          note?: string | null
          shift_request_id: string
          staff_id: string
          start_hour: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          end_hour?: number
          id?: string
          note?: string | null
          shift_request_id?: string
          staff_id?: string
          start_hour?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approved_shifts_shift_request_id_fkey"
            columns: ["shift_request_id"]
            isOneToOne: false
            referencedRelation: "shift_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approved_shifts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_dates: {
        Row: {
          created_at: string
          date: string
          day_of_week: number
          is_holiday: boolean | null
        }
        Insert: {
          created_at?: string
          date: string
          day_of_week: number
          is_holiday?: boolean | null
        }
        Update: {
          created_at?: string
          date?: string
          day_of_week?: number
          is_holiday?: boolean | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          created_at: string
          date: string
          description: string | null
          id: string
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          id?: string
          title: string
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          title?: string
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Relationships: []
      }
      daily_time_slots: {
        Row: {
          created_at: string
          date: string
          end_time: string
          id: string
          is_active: boolean
          start_time: string
          time_slot: Database["public"]["Enums"]["time_slot"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time: string
          id?: string
          is_active?: boolean
          start_time: string
          time_slot: Database["public"]["Enums"]["time_slot"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
          time_slot?: Database["public"]["Enums"]["time_slot"]
          updated_at?: string
        }
        Relationships: []
      }
      options: {
        Row: {
          created_at: string
          description: string | null
          flat_price: number | null
          id: string
          is_active: boolean
          name: string
          price_per_person: number
          pricing_type: Database["public"]["Enums"]["pricing_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          flat_price?: number | null
          id?: string
          is_active?: boolean
          name: string
          price_per_person: number
          pricing_type?: Database["public"]["Enums"]["pricing_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          flat_price?: number | null
          id?: string
          is_active?: boolean
          name?: string
          price_per_person?: number
          pricing_type?: Database["public"]["Enums"]["pricing_type"]
          updated_at?: string
        }
        Relationships: []
      }
      price_settings: {
        Row: {
          created_at: string
          guest_count: number
          id: string
          price_per_person: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          guest_count: number
          id?: string
          price_per_person: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          guest_count?: number
          id?: string
          price_per_person?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          role: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          role?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          role?: string | null
          username?: string | null
        }
        Relationships: []
      }
      reservation_options: {
        Row: {
          created_at: string
          id: string
          option_id: string
          quantity: number
          reservation_id: string
          total_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          quantity?: number
          reservation_id: string
          total_price: number
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          quantity?: number
          reservation_id?: string
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "reservation_options_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_options_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "customer_search"
            referencedColumns: ["reservation_id"]
          },
          {
            foreignKeyName: "reservation_options_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          admin_memo: string | null
          admin_memo_updated_at: string | null
          admin_memo_updated_by: string | null
          confirmation_token: string | null
          created_at: string
          date: string
          email: string | null
          expires_at: string | null
          guest_count: number
          guest_name: string
          id: string
          is_confirmed: boolean | null
          phone: string
          reservation_code: string | null
          status: string
          time_slot: Database["public"]["Enums"]["time_slot"]
          total_price: number
          water_temperature: number
        }
        Insert: {
          admin_memo?: string | null
          admin_memo_updated_at?: string | null
          admin_memo_updated_by?: string | null
          confirmation_token?: string | null
          created_at?: string
          date: string
          email?: string | null
          expires_at?: string | null
          guest_count: number
          guest_name: string
          id?: string
          is_confirmed?: boolean | null
          phone: string
          reservation_code?: string | null
          status?: string
          time_slot: Database["public"]["Enums"]["time_slot"]
          total_price?: number
          water_temperature: number
        }
        Update: {
          admin_memo?: string | null
          admin_memo_updated_at?: string | null
          admin_memo_updated_by?: string | null
          confirmation_token?: string | null
          created_at?: string
          date?: string
          email?: string | null
          expires_at?: string | null
          guest_count?: number
          guest_name?: string
          id?: string
          is_confirmed?: boolean | null
          phone?: string
          reservation_code?: string | null
          status?: string
          time_slot?: Database["public"]["Enums"]["time_slot"]
          total_price?: number
          water_temperature?: number
        }
        Relationships: []
      }
      shift_preferences: {
        Row: {
          created_at: string
          date: string
          id: string
          preference: Database["public"]["Enums"]["shift_preference"]
          staff_id: string
          time_slot: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          preference: Database["public"]["Enums"]["shift_preference"]
          staff_id: string
          time_slot: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          preference?: Database["public"]["Enums"]["shift_preference"]
          staff_id?: string
          time_slot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_preferences_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          date: string
          end_hour: number
          id: string
          note: string | null
          staff_id: string
          start_hour: number
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date: string
          end_hour: number
          id?: string
          note?: string | null
          staff_id: string
          start_hour: number
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date?: string
          end_hour?: number
          id?: string
          note?: string | null
          staff_id?: string
          start_hour?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          break_minutes: number | null
          created_at: string | null
          end_time: string
          id: string
          staff_id: string
          start_time: string
          status: Database["public"]["Enums"]["shift_status"] | null
          updated_at: string | null
        }
        Insert: {
          break_minutes?: number | null
          created_at?: string | null
          end_time: string
          id?: string
          staff_id: string
          start_time: string
          status?: Database["public"]["Enums"]["shift_status"] | null
          updated_at?: string | null
        }
        Update: {
          break_minutes?: number | null
          created_at?: string | null
          end_time?: string
          id?: string
          staff_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["shift_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_closures: {
        Row: {
          created_at: string
          date: string
          id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      staff_auth: {
        Row: {
          created_at: string
          id: string
          password_hash: string
          staff_id: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          password_hash: string
          staff_id: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          password_hash?: string
          staff_id?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_auth_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_hourly_rates: {
        Row: {
          created_at: string
          id: string
          staff_id: string
          updated_at: string
          weekday_rate: number
          weekend_rate: number
        }
        Insert: {
          created_at?: string
          id?: string
          staff_id: string
          updated_at?: string
          weekday_rate?: number
          weekend_rate?: number
        }
        Update: {
          created_at?: string
          id?: string
          staff_id?: string
          updated_at?: string
          weekday_rate?: number
          weekend_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_hourly_rates_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      customer_search: {
        Row: {
          admin_memo: string | null
          created_at: string | null
          date: string | null
          email: string | null
          guest_name: string | null
          phone: string | null
          reservation_id: string | null
          status: string | null
          total_price: number | null
          user_key: string | null
        }
        Insert: {
          admin_memo?: string | null
          created_at?: string | null
          date?: string | null
          email?: string | null
          guest_name?: string | null
          phone?: string | null
          reservation_id?: string | null
          status?: string | null
          total_price?: number | null
          user_key?: never
        }
        Update: {
          admin_memo?: string | null
          created_at?: string | null
          date?: string | null
          email?: string | null
          guest_name?: string | null
          phone?: string | null
          reservation_id?: string | null
          status?: string | null
          total_price?: number | null
          user_key?: never
        }
        Relationships: []
      }
      monthly_salary_summary: {
        Row: {
          month: number | null
          staff_id: string | null
          staff_name: string | null
          total_break_hours: number | null
          total_salary: number | null
          total_shifts: number | null
          total_work_hours: number | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reservation_stats: {
        Row: {
          cancelled_reservations: number | null
          completed_reservations: number | null
          first_visit_date: string | null
          last_reservation_created: string | null
          last_visit_date: string | null
          latest_email: string | null
          latest_name: string | null
          phone: string | null
          total_reservations: number | null
          user_key: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_expired_reservations: { Args: never; Returns: undefined }
      ensure_admin_role: { Args: never; Returns: undefined }
      generate_reservation_code: { Args: never; Returns: string }
    }
    Enums: {
      event_type: "event" | "schedule" | "note"
      pricing_type: "per_person" | "flat"
      shift_preference: "available" | "unavailable"
      shift_status: "scheduled" | "cancelled"
      time_slot: "morning" | "afternoon" | "evening"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      event_type: ["event", "schedule", "note"],
      pricing_type: ["per_person", "flat"],
      shift_preference: ["available", "unavailable"],
      shift_status: ["scheduled", "cancelled"],
      time_slot: ["morning", "afternoon", "evening"],
    },
  },
} as const
