export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
      reservations: {
        Row: {
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
          water_temperature: number
        }
        Insert: {
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
          water_temperature: number
        }
        Update: {
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
      shifts: {
        Row: {
          created_at: string | null
          end_time: string
          id: string
          staff_id: string
          start_time: string
          status: Database["public"]["Enums"]["shift_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_time: string
          id?: string
          staff_id: string
          start_time: string
          status?: Database["public"]["Enums"]["shift_status"] | null
          updated_at?: string | null
        }
        Update: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_reservations: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      ensure_admin_role: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_reservation_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      event_type: "event" | "schedule" | "note"
      shift_preference: "available" | "unavailable"
      shift_status: "scheduled" | "cancelled"
      time_slot: "morning" | "afternoon" | "evening"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
