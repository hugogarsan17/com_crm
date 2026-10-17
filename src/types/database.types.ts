/**
 * Tipos de la base de datos con el formato de `supabase gen types typescript`.
 * Escritos a partir de supabase/migrations. Regenerar tras cambiar el esquema:
 *   npx supabase gen types typescript --project-id <id> --schema public > src/types/database.types.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          phone: string | null;
          email: string | null;
          locality: string | null;
          customer_reference: string | null;
          current_policies: string[];
          product_to_offer: string | null;
          source: string | null;
          status: Database["public"]["Enums"]["lead_status"];
          priority: Database["public"]["Enums"]["lead_priority"];
          notes: string | null;
          received_at: string;
          next_action: string | null;
          next_follow_up_at: string | null;
          last_contact_at: string | null;
          last_outcome: Database["public"]["Enums"]["activity_outcome"] | null;
          closed_at: string | null;
          closed_reason: string | null;
          phone_normalized: string | null;
          email_normalized: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          full_name: string;
          phone?: string | null;
          email?: string | null;
          locality?: string | null;
          customer_reference?: string | null;
          current_policies?: string[];
          product_to_offer?: string | null;
          source?: string | null;
          status?: Database["public"]["Enums"]["lead_status"];
          priority?: Database["public"]["Enums"]["lead_priority"];
          notes?: string | null;
          received_at?: string;
          closed_at?: string | null;
          closed_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          full_name?: string;
          phone?: string | null;
          email?: string | null;
          locality?: string | null;
          customer_reference?: string | null;
          current_policies?: string[];
          product_to_offer?: string | null;
          source?: string | null;
          status?: Database["public"]["Enums"]["lead_status"];
          priority?: Database["public"]["Enums"]["lead_priority"];
          notes?: string | null;
          received_at?: string;
          closed_at?: string | null;
          closed_reason?: string | null;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          user_id: string;
          lead_id: string;
          channel: Database["public"]["Enums"]["activity_channel"];
          outcome: Database["public"]["Enums"]["activity_outcome"];
          summary: string | null;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          lead_id: string;
          channel: Database["public"]["Enums"]["activity_channel"];
          outcome: Database["public"]["Enums"]["activity_outcome"];
          summary?: string | null;
          occurred_at?: string;
          created_at?: string;
        };
        Update: {
          channel?: Database["public"]["Enums"]["activity_channel"];
          outcome?: Database["public"]["Enums"]["activity_outcome"];
          summary?: string | null;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activities_lead_fkey";
            columns: ["lead_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          lead_id: string;
          title: string;
          description: string | null;
          due_at: string;
          status: Database["public"]["Enums"]["task_status"];
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          lead_id: string;
          title: string;
          description?: string | null;
          due_at: string;
          status?: Database["public"]["Enums"]["task_status"];
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          due_at?: string;
          status?: Database["public"]["Enums"]["task_status"];
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_lead_fkey";
            columns: ["lead_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      policies: {
        Row: {
          id: string;
          user_id: string;
          lead_id: string;
          product_name: string;
          contracted_at: string | null;
          premium_amount: number | null;
          estimated_commission: number | null;
          confirmed_commission: number | null;
          commission_status: Database["public"]["Enums"]["commission_status"];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          lead_id: string;
          product_name: string;
          contracted_at?: string | null;
          premium_amount?: number | null;
          estimated_commission?: number | null;
          confirmed_commission?: number | null;
          commission_status?: Database["public"]["Enums"]["commission_status"];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          product_name?: string;
          contracted_at?: string | null;
          premium_amount?: number | null;
          estimated_commission?: number | null;
          confirmed_commission?: number | null;
          commission_status?: Database["public"]["Enums"]["commission_status"];
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "policies_lead_fkey";
            columns: ["lead_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      log_activity: {
        Args: {
          p_lead_id: string;
          p_channel: Database["public"]["Enums"]["activity_channel"];
          p_outcome: Database["public"]["Enums"]["activity_outcome"];
          p_occurred_at: string;
          p_summary?: string | null;
          p_new_status?: Database["public"]["Enums"]["lead_status"] | null;
          p_closed_reason?: string | null;
          p_follow_up_title?: string | null;
          p_follow_up_due_at?: string | null;
        };
        Returns: Json;
      };
      get_dashboard_summary: {
        Args: { p_from: string; p_to: string; p_tz?: string };
        Returns: Json;
      };
      get_report: {
        Args: { p_from: string; p_to: string; p_tz?: string; p_product?: string | null };
        Returns: Json;
      };
      get_results_series: {
        Args: { p_from: string; p_to: string; p_tz?: string; p_bucket?: string };
        Returns: Json;
      };
      get_product_options: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      find_lead_duplicates: {
        Args: { p_phones?: string[]; p_emails?: string[]; p_references?: string[] };
        Returns: Json;
      };
      import_leads: {
        Args: { p_rows: Json };
        Returns: number;
      };
      delete_my_account: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      normalize_phone: {
        Args: { p_phone: string };
        Returns: string;
      };
    };
    Enums: {
      lead_status:
        | "pending_contact"
        | "no_answer"
        | "follow_up"
        | "interested"
        | "proposal_in_progress"
        | "policy_contracted"
        | "rejected"
        | "keeps_current_conditions"
        | "do_not_contact";
      lead_priority: "low" | "normal" | "high";
      task_status: "pending" | "completed" | "cancelled";
      commission_status: "pending" | "confirmed" | "paid";
      activity_channel: "call" | "whatsapp" | "sms" | "email" | "visit" | "other";
      activity_outcome:
        | "no_answer"
        | "spoke"
        | "interested"
        | "info_requested"
        | "call_back"
        | "proposal_sent"
        | "contracted"
        | "rejected"
        | "keeps_conditions"
        | "wrong_contact"
        | "do_not_contact"
        | "other";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
