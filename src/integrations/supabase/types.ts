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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      day_entries: {
        Row: {
          check_in_at: string | null
          check_out_at: string | null
          created_at: string
          device_info: string | null
          entry_date: string
          id: string
          ip_address: string | null
          lunch_break_end: string | null
          lunch_break_start: string | null
          status: string
          total_work_time_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          check_in_at?: string | null
          check_out_at?: string | null
          created_at?: string
          device_info?: string | null
          entry_date: string
          id?: string
          ip_address?: string | null
          lunch_break_end?: string | null
          lunch_break_start?: string | null
          status?: string
          total_work_time_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          check_in_at?: string | null
          check_out_at?: string | null
          created_at?: string
          device_info?: string | null
          entry_date?: string
          id?: string
          ip_address?: string | null
          lunch_break_end?: string | null
          lunch_break_start?: string | null
          status?: string
          total_work_time_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      day_updates: {
        Row: {
          blockers: string | null
          created_at: string
          day_entry_id: string
          id: string
          progress: string
          today_focus: string
          updated_at: string
        }
        Insert: {
          blockers?: string | null
          created_at?: string
          day_entry_id: string
          id?: string
          progress: string
          today_focus: string
          updated_at?: string
        }
        Update: {
          blockers?: string | null
          created_at?: string
          day_entry_id?: string
          id?: string
          progress?: string
          today_focus?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_updates_day_entry_id_fkey"
            columns: ["day_entry_id"]
            isOneToOne: false
            referencedRelation: "day_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string
          sender_id: string
          id: string
          is_read: boolean
          message: string
          to_user_id: string
        }
        Insert: {
          created_at?: string
          sender_id: string
          id?: string
          is_read?: boolean
          message: string
          to_user_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          is_read?: boolean
          message?: string
          to_user_id?: string
        }
        Relationships: []
      }
      office_rules: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          team: string | null
          designation: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_active?: boolean
          name: string
          team?: string | null
          designation?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          team?: string | null
          designation?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rule_acknowledgments: {
        Row: {
          acknowledged_at: string
          id: string
          rule_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          rule_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          rule_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_acknowledgments_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "office_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_contracts: {
        Row: {
          created_at: string
          id: string
          initials: string
          signed_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          initials: string
          signed_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          initials?: string
          signed_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rule_violations: {
        Row: {
          created_at: string
          flagged_at: string
          flagged_by: string
          id: string
          reason: string | null
          rule_id: string
          user_id: string
          warning_level: number
        }
        Insert: {
          created_at?: string
          flagged_at?: string
          flagged_by: string
          id?: string
          reason?: string | null
          rule_id: string
          user_id: string
          warning_level: number
        }
        Update: {
          created_at?: string
          flagged_at?: string
          flagged_by?: string
          id?: string
          reason?: string | null
          rule_id?: string
          user_id?: string
          warning_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "rule_violations_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "office_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          name: string
          phone: string | null
          email: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          phone?: string | null
          email: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          email?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      conversations: {
        Row: {
          id: string
          participant_1: string
          participant_2: string
          last_message_at: string | null
          last_message_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          participant_1: string
          participant_2: string
          last_message_at?: string | null
          last_message_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          participant_1?: string
          participant_2?: string
          last_message_at?: string | null
          last_message_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_participant_1_fkey"
            columns: ["participant_1"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          assigned_to: string
          assigned_by: string
          status: string
          priority: string
          due_date: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          assigned_to: string
          assigned_by: string
          status?: string
          priority?: string
          due_date?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          assigned_to?: string
          assigned_by?: string
          status?: string
          priority?: string
          due_date?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      extra_work_logs: {
        Row: {
          id: string
          day_entry_id: string
          user_id: string
          work_type: string
          hours_worked: number
          description: string | null
          logged_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          day_entry_id: string
          user_id: string
          work_type?: string
          hours_worked: number
          description?: string | null
          logged_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          day_entry_id?: string
          user_id?: string
          work_type?: string
          hours_worked?: number
          description?: string | null
          logged_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extra_work_logs_day_entry_id_fkey"
            columns: ["day_entry_id"]
            isOneToOne: false
            referencedRelation: "day_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_work_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      leave_types: {
        Row: {
          id: string
          name: string
          description: string | null
          max_days_per_year: number
          is_paid: boolean
          requires_approval: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          max_days_per_year?: number
          is_paid?: boolean
          requires_approval?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          max_days_per_year?: number
          is_paid?: boolean
          requires_approval?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          id: string
          user_id: string
          leave_type_id: string
          start_date: string
          end_date: string
          days_requested: number
          reason: string | null
          work_from_home: boolean
          status: string
          approved_by: string | null
          approved_at: string | null
          rejection_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          leave_type_id: string
          start_date: string
          end_date: string
          days_requested: number
          reason?: string | null
          work_from_home?: boolean
          status?: string
          approved_by?: string | null
          approved_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          leave_type_id?: string
          start_date?: string
          end_date?: string
          days_requested?: number
          reason?: string | null
          work_from_home?: boolean
          status?: string
          approved_by?: string | null
          approved_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      leave_balances: {
        Row: {
          id: string
          user_id: string
          leave_type_id: string
          year: number
          total_days: number
          used_days: number
          remaining_days: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          leave_type_id: string
          year: number
          total_days?: number
          used_days?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          leave_type_id?: string
          year?: number
          total_days?: number
          used_days?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          }
        ]
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string
          is_read: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content: string
          is_read?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          content?: string
          is_read?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_team: {
        Args: { _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_unlogged_days: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      mark_unlogged_days_range: {
        Args: { end_date: string; start_date: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "employee"
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
      app_role: ["admin", "manager", "employee"],
    },
  },
} as const
