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
      agent_action_logs: {
        Row: {
          channel: string
          client: string | null
          created_at: string
          error: string | null
          id: string
          input: Json | null
          result_summary: string | null
          status: string
          tool: string
          tool_title: string | null
          user_id: string | null
        }
        Insert: {
          channel: string
          client?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input?: Json | null
          result_summary?: string | null
          status: string
          tool: string
          tool_title?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string
          client?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input?: Json | null
          result_summary?: string | null
          status?: string
          tool?: string
          tool_title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_action_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_email_campaigns: {
        Row: {
          body_html: string
          completed_at: string | null
          created_at: string
          failed_count: number
          id: string
          sent_count: number
          status: string
          subject: string
          total_recipients: number
        }
        Insert: {
          body_html: string
          completed_at?: string | null
          created_at?: string
          failed_count?: number
          id?: string
          sent_count?: number
          status?: string
          subject: string
          total_recipients?: number
        }
        Update: {
          body_html?: string
          completed_at?: string | null
          created_at?: string
          failed_count?: number
          id?: string
          sent_count?: number
          status?: string
          subject?: string
          total_recipients?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          last_visit_date: string | null
          marketing_email_opt_in: boolean
          name: string | null
          notes: string | null
          phone: string | null
          source: string
          updated_at: string
          visit_count: number
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          last_visit_date?: string | null
          marketing_email_opt_in?: boolean
          name?: string | null
          notes?: string | null
          phone?: string | null
          source?: string
          updated_at?: string
          visit_count?: number
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          last_visit_date?: string | null
          marketing_email_opt_in?: boolean
          name?: string | null
          notes?: string | null
          phone?: string | null
          source?: string
          updated_at?: string
          visit_count?: number
        }
        Relationships: []
      }
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
      event_reservations: {
        Row: {
          access_token: string
          cancelled_at: string | null
          created_at: string
          email: string
          expires_at: string | null
          guest_count: number
          guest_name: string
          id: string
          payment_method: string | null
          payment_status: string
          phone: string
          reservation_code: string
          slot_id: string
          square_order_id: string | null
          square_payment_id: string | null
          square_payment_link_id: string | null
          status: string
          total_price: number
          updated_at: string
        }
        Insert: {
          access_token: string
          cancelled_at?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          guest_count: number
          guest_name: string
          id?: string
          payment_method?: string | null
          payment_status?: string
          phone: string
          reservation_code: string
          slot_id: string
          square_order_id?: string | null
          square_payment_id?: string | null
          square_payment_link_id?: string | null
          status?: string
          total_price?: number
          updated_at?: string
        }
        Update: {
          access_token?: string
          cancelled_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          guest_count?: number
          guest_name?: string
          id?: string
          payment_method?: string | null
          payment_status?: string
          phone?: string
          reservation_code?: string
          slot_id?: string
          square_order_id?: string | null
          square_payment_id?: string | null
          square_payment_link_id?: string | null
          status?: string
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reservations_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "event_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      event_slots: {
        Row: {
          capacity: number
          created_at: string
          date: string
          end_time: string
          event_id: string
          id: string
          is_active: boolean
          start_time: string
          updated_at: string
        }
        Insert: {
          capacity: number
          created_at?: string
          date: string
          end_time: string
          event_id: string
          id?: string
          is_active?: boolean
          start_time: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          date?: string
          end_time?: string
          event_id?: string
          id?: string
          is_active?: boolean
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_slots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          id: string
          max_guests_per_reservation: number
          payment_type: string
          price_note: string | null
          price_per_person: number
          slug: string
          status: string
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          max_guests_per_reservation?: number
          payment_type?: string
          price_note?: string | null
          price_per_person?: number
          slug: string
          status?: string
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          max_guests_per_reservation?: number
          payment_type?: string
          price_note?: string | null
          price_per_person?: number
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      herb_blend_herbs: {
        Row: {
          blend_id: string
          herb_id: string
          sort_order: number
        }
        Insert: {
          blend_id: string
          herb_id: string
          sort_order?: number
        }
        Update: {
          blend_id?: string
          herb_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "herb_blend_herbs_blend_id_fkey"
            columns: ["blend_id"]
            isOneToOne: false
            referencedRelation: "herb_blends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "herb_blend_herbs_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs"
            referencedColumns: ["id"]
          },
        ]
      }
      herb_blends: {
        Row: {
          active: boolean
          caution: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          is_original: boolean
          needs_prep: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          caution?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_original?: boolean
          needs_prep?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          caution?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_original?: boolean
          needs_prep?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      herb_settings: {
        Row: {
          id: boolean
          recommended_tier1_blend_id: string | null
          recommended_tier2_blend_id: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          recommended_tier1_blend_id?: string | null
          recommended_tier2_blend_id?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          recommended_tier1_blend_id?: string | null
          recommended_tier2_blend_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "herb_settings_recommended_tier1_blend_id_fkey"
            columns: ["recommended_tier1_blend_id"]
            isOneToOne: false
            referencedRelation: "herb_blends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "herb_settings_recommended_tier2_blend_id_fkey"
            columns: ["recommended_tier2_blend_id"]
            isOneToOne: false
            referencedRelation: "herb_blends"
            referencedColumns: ["id"]
          },
        ]
      }
      herbs: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          note: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          note: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          note?: string
          sort_order?: number
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
          access_token: string | null
          admin_memo: string | null
          admin_memo_updated_at: string | null
          admin_memo_updated_by: string | null
          confirmation_token: string | null
          created_at: string
          date: string
          email: string | null
          end_time: string
          expires_at: string | null
          guest_count: number
          guest_name: string
          herb_choice: string | null
          herb_selection: Json | null
          herb_updated_at: string | null
          herb_updated_by: string | null
          id: string
          is_confirmed: boolean | null
          payment_method: string
          payment_status: string
          phone: string
          reservation_code: string | null
          square_order_id: string | null
          square_payment_id: string | null
          square_payment_link_id: string | null
          start_time: string
          status: string
          time_slot: Database["public"]["Enums"]["time_slot"]
          total_price: number
          water_temperature: number
        }
        Insert: {
          access_token?: string | null
          admin_memo?: string | null
          admin_memo_updated_at?: string | null
          admin_memo_updated_by?: string | null
          confirmation_token?: string | null
          created_at?: string
          date: string
          email?: string | null
          end_time?: string
          expires_at?: string | null
          guest_count: number
          guest_name: string
          herb_choice?: string | null
          herb_selection?: Json | null
          herb_updated_at?: string | null
          herb_updated_by?: string | null
          id?: string
          is_confirmed?: boolean | null
          payment_method?: string
          payment_status?: string
          phone: string
          reservation_code?: string | null
          square_order_id?: string | null
          square_payment_id?: string | null
          square_payment_link_id?: string | null
          start_time?: string
          status?: string
          time_slot: Database["public"]["Enums"]["time_slot"]
          total_price?: number
          water_temperature: number
        }
        Update: {
          access_token?: string | null
          admin_memo?: string | null
          admin_memo_updated_at?: string | null
          admin_memo_updated_by?: string | null
          confirmation_token?: string | null
          created_at?: string
          date?: string
          email?: string | null
          end_time?: string
          expires_at?: string | null
          guest_count?: number
          guest_name?: string
          herb_choice?: string | null
          herb_selection?: Json | null
          herb_updated_at?: string | null
          herb_updated_by?: string | null
          id?: string
          is_confirmed?: boolean | null
          payment_method?: string
          payment_status?: string
          phone?: string
          reservation_code?: string | null
          square_order_id?: string | null
          square_payment_id?: string | null
          square_payment_link_id?: string | null
          start_time?: string
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
          event_id: string | null
          id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          event_id?: string | null
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          event_id?: string | null
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_closures_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_access_tokens: {
        Row: {
          created_at: string
          staff_id: string
          token: string
        }
        Insert: {
          created_at?: string
          staff_id: string
          token?: string
        }
        Update: {
          created_at?: string
          staff_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_access_tokens_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      staff_hourly_rate_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          note: string | null
          staff_id: string
          start_date: string
          weekday_rate: number
          weekend_rate: number
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          note?: string | null
          staff_id: string
          start_date: string
          weekday_rate: number
          weekend_rate: number
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          note?: string | null
          staff_id?: string
          start_date?: string
          weekday_rate?: number
          weekend_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_hourly_rate_periods_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_slot_patterns: {
        Row: {
          afternoon_end: string
          afternoon_start: string
          created_at: string
          evening_end: string
          evening_start: string
          id: string
          morning_end: string
          morning_start: string
          name: string
          night_end: string | null
          night_start: string | null
          updated_at: string
        }
        Insert: {
          afternoon_end?: string
          afternoon_start?: string
          created_at?: string
          evening_end?: string
          evening_start?: string
          id?: string
          morning_end?: string
          morning_start?: string
          name: string
          night_end?: string | null
          night_start?: string | null
          updated_at?: string
        }
        Update: {
          afternoon_end?: string
          afternoon_start?: string
          created_at?: string
          evening_end?: string
          evening_start?: string
          id?: string
          morning_end?: string
          morning_start?: string
          name?: string
          night_end?: string | null
          night_start?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      work_areas: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      work_items: {
        Row: {
          active: boolean
          area_id: string
          category: string
          created_at: string
          description: string | null
          frequency_days: number | null
          id: string
          name: string
          photo_required: boolean
          points: number
          quantity_label: string | null
          quantity_unit: string | null
          repeatable: boolean
          sort_order: number
        }
        Insert: {
          active?: boolean
          area_id: string
          category?: string
          created_at?: string
          description?: string | null
          frequency_days?: number | null
          id?: string
          name: string
          photo_required?: boolean
          points?: number
          quantity_label?: string | null
          quantity_unit?: string | null
          repeatable?: boolean
          sort_order?: number
        }
        Update: {
          active?: boolean
          area_id?: string
          category?: string
          created_at?: string
          description?: string | null
          frequency_days?: number | null
          id?: string
          name?: string
          photo_required?: boolean
          points?: number
          quantity_label?: string | null
          quantity_unit?: string | null
          repeatable?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_items_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "work_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      work_log_photos: {
        Row: {
          created_at: string
          id: string
          log_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          log_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          log_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_log_photos_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "work_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      work_logs: {
        Row: {
          area_id: string
          category: string
          created_at: string
          id: string
          item_id: string | null
          note: string | null
          points: number
          quantity: number | null
          quantity_unit: string | null
          rejected: boolean
          staff_id: string
          task_id: string | null
          title: string
          work_date: string
          worked_at: string
        }
        Insert: {
          area_id: string
          category: string
          created_at?: string
          id?: string
          item_id?: string | null
          note?: string | null
          points?: number
          quantity?: number | null
          quantity_unit?: string | null
          rejected?: boolean
          staff_id: string
          task_id?: string | null
          title: string
          work_date?: string
          worked_at?: string
        }
        Update: {
          area_id?: string
          category?: string
          created_at?: string
          id?: string
          item_id?: string | null
          note?: string | null
          points?: number
          quantity?: number | null
          quantity_unit?: string | null
          rejected?: boolean
          staff_id?: string
          task_id?: string | null
          title?: string
          work_date?: string
          worked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_logs_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "work_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "work_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      work_point_settings: {
        Row: {
          id: boolean
          monthly_bonus_cap: number
          target_points_per_hour: number
          updated_at: string
          yen_per_point: number
        }
        Insert: {
          id?: boolean
          monthly_bonus_cap?: number
          target_points_per_hour?: number
          updated_at?: string
          yen_per_point?: number
        }
        Update: {
          id?: boolean
          monthly_bonus_cap?: number
          target_points_per_hour?: number
          updated_at?: string
          yen_per_point?: number
        }
        Relationships: []
      }
      work_tasks: {
        Row: {
          area_id: string
          assignee_id: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          done_at: string | null
          due_date: string | null
          id: string
          item_id: string | null
          points: number
          status: string
          title: string
        }
        Insert: {
          area_id: string
          assignee_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          item_id?: string | null
          points?: number
          status?: string
          title: string
        }
        Update: {
          area_id?: string
          assignee_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          item_id?: string | null
          points?: number
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_tasks_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "work_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tasks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      herb_affected_reservations: {
        Row: {
          blend_code: string | null
          blend_inactive: boolean | null
          blend_title: string | null
          date: string | null
          guest_count: number | null
          guest_name: string | null
          herb_choice: string | null
          id: string | null
          phone: string | null
          reservation_code: string | null
          start_time: string | null
          status: string | null
          tier: number | null
          unavailable_herbs: string | null
        }
        Relationships: []
      }
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
      work_item_last_logs: {
        Row: {
          item_id: string | null
          staff_name: string | null
          worked_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_set_reservation_herbs: {
        Args: { p_choice: string; p_reservation_id: string; p_tiers: Json }
        Returns: Json
      }
      cleanup_expired_reservations: { Args: never; Returns: undefined }
      create_agent_api_key: {
        Args: { p_name: string; p_user_id: string }
        Returns: string
      }
      ensure_admin_role: { Args: never; Returns: undefined }
      generate_reservation_code: { Args: never; Returns: string }
      get_herb_catalog: { Args: never; Returns: Json }
      staff_id_for_token: { Args: { p_token: string }; Returns: string }
      staff_work_get: { Args: { p_token: string }; Returns: Json }
      staff_work_log_create: {
        Args: {
          p_area_id: string
          p_item_id: string | null
          p_note: string | null
          p_photo_paths: string[] | null
          p_quantity: number | null
          p_task_id: string | null
          p_title: string | null
          p_token: string
        }
        Returns: Json
      }
      staff_work_log_delete: {
        Args: { p_log_id: string; p_token: string }
        Returns: undefined
      }
      staff_work_task_create: {
        Args: {
          p_area_id: string
          p_category: string
          p_description: string | null
          p_item_id: string | null
          p_title: string
          p_token: string
        }
        Returns: string
      }
      work_bonus_summary: {
        Args: { p_month: number; p_year: number }
        Returns: {
          bonus_yen: number
          log_count: number
          points: number
          staff_id: string
          staff_name: string
          target_points: number
          work_hours: number
        }[]
      }
    }
    Enums: {
      event_type: "event" | "schedule" | "note"
      pricing_type: "per_person" | "flat" | "per_guest"
      shift_preference: "available" | "unavailable"
      shift_status: "scheduled" | "cancelled"
      time_slot: "morning" | "afternoon" | "evening" | "night"
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
      pricing_type: ["per_person", "flat", "per_guest"],
      shift_preference: ["available", "unavailable"],
      shift_status: ["scheduled", "cancelled"],
      time_slot: ["morning", "afternoon", "evening", "night"],
    },
  },
} as const
