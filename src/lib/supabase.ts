import { createClient } from "@supabase/supabase-js";

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const appEnv = import.meta.env.VITE_APP_ENV || "development";

// Check if Supabase credentials are available
const hasSupabaseCredentials = supabaseUrl && supabaseKey;

// Only show warnings in development or if there are actual issues
if (!hasSupabaseCredentials) {
  if (appEnv === "development") {
    console.warn(
      "⚠️ Supabase credentials not found. App will use localStorage fallback."
    );
  } else if (appEnv === "production") {
    console.error(
      "🚨 CRITICAL: Production build is missing Supabase credentials!"
    );
  }
}

// Validate environment value
if (appEnv && !["development", "production"].includes(appEnv)) {
  throw new Error(
    `Invalid VITE_APP_ENV: ${appEnv}. Must be 'development' or 'production'`
  );
}

// Create Supabase client only if credentials are available
export const supabase = hasSupabaseCredentials
  ? createClient(supabaseUrl, supabaseKey, {
      db: {
        schema: "public",
      },
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          "Accept-Profile": "public",
          "Content-Profile": "public",
        },
      },
    })
  : null;

// Export environment info for debugging
export const isDev = appEnv === "development";
export const isProd = appEnv === "production";

// Simple initialization logging
if (appEnv === "development") {
  if (hasSupabaseCredentials) {
    console.log(`🚀 App running in ${appEnv} mode with Supabase`);
  } else {
    console.log(`🚀 App running in ${appEnv} mode with localStorage fallback`);
  }
}

export interface Database {
  public: {
    Tables: {
      budgets: {
        Row: {
          id: string;
          user_id: string;
          month_key: string;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month_key: string;
          amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          month_key?: string;
          amount?: number;
          created_at?: string;
        };
      };
      expenses: {
        Row: {
          id: string;
          user_id: string;
          month_key: string;
          date: string;
          amount: number;
          category?: string;
          note?: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month_key: string;
          date: string;
          amount: number;
          category?: string;
          note?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          month_key?: string;
          date?: string;
          amount?: number;
          category?: string;
          note?: string;
          created_at?: string;
        };
      };
      plans: {
        Row: {
          id: string;
          user_id: string;
          month_key: string;
          week_index: number;
          amount: number;
          category?: string;
          note?: string;
          target_date?: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month_key: string;
          week_index: number;
          amount: number;
          category?: string;
          note?: string;
          target_date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          month_key?: string;
          week_index?: number;
          amount?: number;
          category?: string;
          note?: string;
          target_date?: string;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
