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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_balances: {
        Row: {
          account_id: string
          currency: string
          current_balance: number
          initial_balance: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          currency: string
          current_balance?: number
          initial_balance?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          currency?: string
          current_balance?: number
          initial_balance?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_balances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_group_members: {
        Row: {
          account_id: string
          created_at: string | null
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_group_members_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      account_groups: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      account_transactions: {
        Row: {
          amount: number
          base_amount: number | null
          created_at: string | null
          currency: string | null
          exchange_rate: number | null
          forecast_enabled: boolean
          forecast_flow_id: string | null
          from_account_id: string | null
          id: string
          in_forecast: boolean
          month_key: string | null
          note: string | null
          savings_goal_id: string | null
          to_account_id: string | null
          to_amount: number | null
          to_currency: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          base_amount?: number | null
          created_at?: string | null
          currency?: string | null
          exchange_rate?: number | null
          forecast_enabled?: boolean
          forecast_flow_id?: string | null
          from_account_id?: string | null
          id?: string
          in_forecast?: boolean
          month_key?: string | null
          note?: string | null
          savings_goal_id?: string | null
          to_account_id?: string | null
          to_amount?: number | null
          to_currency?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          base_amount?: number | null
          created_at?: string | null
          currency?: string | null
          exchange_rate?: number | null
          forecast_enabled?: boolean
          forecast_flow_id?: string | null
          from_account_id?: string | null
          id?: string
          in_forecast?: boolean
          month_key?: string | null
          note?: string | null
          savings_goal_id?: string | null
          to_account_id?: string | null
          to_amount?: number | null
          to_currency?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_transactions_forecast_flow_id_fkey"
            columns: ["forecast_flow_id"]
            isOneToOne: false
            referencedRelation: "forecast_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transactions_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transactions_savings_goal_id_fkey"
            columns: ["savings_goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_type: string
          color: string | null
          created_at: string | null
          currencies: string[]
          currency: string
          current_balance: number
          icon: string | null
          id: string
          initial_balance: number
          is_default: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_type: string
          color?: string | null
          created_at?: string | null
          currencies?: string[]
          currency?: string
          current_balance?: number
          icon?: string | null
          id?: string
          initial_balance?: number
          is_default?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_type?: string
          color?: string | null
          created_at?: string | null
          currencies?: string[]
          currency?: string
          current_balance?: number
          icon?: string | null
          id?: string
          initial_balance?: number
          is_default?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      budget_allocations: {
        Row: {
          account_id: string
          amount: number
          created_at: string | null
          id: string
          month_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string | null
          id?: string
          month_key: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string | null
          id?: string
          month_key?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_allocations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          month_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          month_key: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          month_key?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string
          created_at: string | null
          icon: string
          id: string
          is_default: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string | null
          icon: string
          id?: string
          is_default?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          icon?: string
          id?: string
          is_default?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      drafts: {
        Row: {
          account_id: string | null
          amount: number | null
          category: string | null
          created_at: string | null
          date: string | null
          id: string
          note: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          category?: string | null
          created_at?: string | null
          date?: string | null
          id?: string
          note: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          category?: string | null
          created_at?: string | null
          date?: string | null
          id?: string
          note?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          currency: string
          rate: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          currency: string
          rate: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          currency?: string
          rate?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          category_id: string | null
          created_at: string | null
          date: string
          exchange_rate: number | null
          forecast_enabled: boolean
          forecast_flow_id: string | null
          id: string
          in_forecast: boolean
          month_key: string
          note: string | null
          original_amount: number | null
          original_currency: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          date: string
          exchange_rate?: number | null
          forecast_enabled?: boolean
          forecast_flow_id?: string | null
          id?: string
          in_forecast?: boolean
          month_key: string
          note?: string | null
          original_amount?: number | null
          original_currency?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          date?: string
          exchange_rate?: number | null
          forecast_enabled?: boolean
          forecast_flow_id?: string | null
          id?: string
          in_forecast?: boolean
          month_key?: string
          note?: string | null
          original_amount?: number | null
          original_currency?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_forecast_flow_id_fkey"
            columns: ["forecast_flow_id"]
            isOneToOne: false
            referencedRelation: "forecast_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_flows: {
        Row: {
          created_at: string | null
          enabled: boolean
          high_value: number | null
          id: string
          is_ghost: boolean
          low_value: number | null
          months: number[]
          name: string | null
          rule_account_ids: string[]
          rule_category_ids: string[]
          rule_exclude_linked: boolean
          rule_fixed_value: number | null
          rule_projection: string
          rule_projection_window: number
          rule_source: string | null
          rule_target_value: number | null
          sort_order: number | null
          type: string
          uncertain: boolean
          updated_at: string | null
          user_id: string
          value: number | null
          year: number
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean
          high_value?: number | null
          id?: string
          is_ghost?: boolean
          low_value?: number | null
          months?: number[]
          name?: string | null
          rule_account_ids?: string[]
          rule_category_ids?: string[]
          rule_exclude_linked?: boolean
          rule_fixed_value?: number | null
          rule_projection?: string
          rule_projection_window?: number
          rule_source?: string | null
          rule_target_value?: number | null
          sort_order?: number | null
          type: string
          uncertain?: boolean
          updated_at?: string | null
          user_id: string
          value?: number | null
          year: number
        }
        Update: {
          created_at?: string | null
          enabled?: boolean
          high_value?: number | null
          id?: string
          is_ghost?: boolean
          low_value?: number | null
          months?: number[]
          name?: string | null
          rule_account_ids?: string[]
          rule_category_ids?: string[]
          rule_exclude_linked?: boolean
          rule_fixed_value?: number | null
          rule_projection?: string
          rule_projection_window?: number
          rule_source?: string | null
          rule_target_value?: number | null
          sort_order?: number | null
          type?: string
          uncertain?: boolean
          updated_at?: string | null
          user_id?: string
          value?: number | null
          year?: number
        }
        Relationships: []
      }
      plans: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          category_id: string | null
          created_at: string | null
          forecast_enabled: boolean
          forecast_flow_id: string | null
          id: string
          in_forecast: boolean
          is_completed: boolean | null
          month_key: string
          note: string | null
          target_date: string | null
          updated_at: string | null
          user_id: string
          week_index: number
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          forecast_enabled?: boolean
          forecast_flow_id?: string | null
          id?: string
          in_forecast?: boolean
          is_completed?: boolean | null
          month_key: string
          note?: string | null
          target_date?: string | null
          updated_at?: string | null
          user_id: string
          week_index: number
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          forecast_enabled?: boolean
          forecast_flow_id?: string | null
          id?: string
          in_forecast?: boolean
          is_completed?: boolean | null
          month_key?: string
          note?: string | null
          target_date?: string | null
          updated_at?: string | null
          user_id?: string
          week_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "plans_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_forecast_flow_id_fkey"
            columns: ["forecast_flow_id"]
            isOneToOne: false
            referencedRelation: "forecast_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      savings_contributions: {
        Row: {
          account_id: string
          amount: number
          created_at: string | null
          id: string
          note: string | null
          savings_goal_id: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string | null
          id?: string
          note?: string | null
          savings_goal_id: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string | null
          id?: string
          note?: string | null
          savings_goal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_contributions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_contributions_savings_goal_id_fkey"
            columns: ["savings_goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          color: string | null
          completed_at: string | null
          created_at: string | null
          current_amount: number
          deadline: string | null
          id: string
          image_url: string | null
          is_completed: boolean | null
          name: string
          target_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_amount?: number
          deadline?: string | null
          id?: string
          image_url?: string | null
          is_completed?: boolean | null
          name: string
          target_amount: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_amount?: number
          deadline?: string | null
          id?: string
          image_url?: string | null
          is_completed?: boolean | null
          name?: string
          target_amount?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      spreadsheet_entries: {
        Row: {
          column_key: string
          created_at: string | null
          id: string
          month_key: string
          user_id: string
          value: number
        }
        Insert: {
          column_key: string
          created_at?: string | null
          id?: string
          month_key: string
          user_id: string
          value?: number
        }
        Update: {
          column_key?: string
          created_at?: string | null
          id?: string
          month_key?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          base_currency: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          base_currency?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          base_currency?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_monthly_summary: {
        Args: never
        Returns: {
          budget_amount: number
          expense_count: number
          month_key: string
          remaining_budget: number
          total_expenses: number
          user_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
