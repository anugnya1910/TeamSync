// Database types in the `supabase gen types typescript` format.
// Regenerate with `npm run gen:types` (requires the local Supabase stack). CI regenerates this
// file from the migrated schema and re-runs the typecheck to detect drift.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string;
          handle: string;
          id: string;
          job_title: string | null;
          last_workspace_id: string | null;
          notification_prefs: Json;
          onboarded_at: string | null;
          reduced_motion: boolean;
          show_on_leaderboard: boolean;
          theme: string;
          timezone: string;
          updated_at: string;
          week_start: number;
          weekend_streak_protection: boolean;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name: string;
          handle: string;
          id: string;
          job_title?: string | null;
          last_workspace_id?: string | null;
          notification_prefs?: Json;
          onboarded_at?: string | null;
          reduced_motion?: boolean;
          show_on_leaderboard?: boolean;
          theme?: string;
          timezone?: string;
          updated_at?: string;
          week_start?: number;
          weekend_streak_protection?: boolean;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string;
          handle?: string;
          id?: string;
          job_title?: string | null;
          last_workspace_id?: string | null;
          notification_prefs?: Json;
          onboarded_at?: string | null;
          reduced_motion?: boolean;
          show_on_leaderboard?: boolean;
          theme?: string;
          timezone?: string;
          updated_at?: string;
          week_start?: number;
          weekend_streak_protection?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_last_workspace_fk";
            columns: ["last_workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_members: {
        Row: {
          joined_at: string;
          role: Database["public"]["Enums"]["workspace_role"];
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          joined_at?: string;
          role?: Database["public"]["Enums"]["workspace_role"];
          user_id: string;
          workspace_id: string;
        };
        Update: {
          joined_at?: string;
          role?: Database["public"]["Enums"]["workspace_role"];
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          ai_daily_limit: number;
          ai_enabled: boolean;
          created_at: string;
          deleted_at: string | null;
          gamification_enabled: boolean;
          id: string;
          logo_url: string | null;
          name: string;
          owner_id: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          ai_daily_limit?: number;
          ai_enabled?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          gamification_enabled?: boolean;
          id?: string;
          logo_url?: string | null;
          name: string;
          owner_id: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          ai_daily_limit?: number;
          ai_enabled?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          gamification_enabled?: boolean;
          id?: string;
          logo_url?: string | null;
          name?: string;
          owner_id?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspaces_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_onboarding: {
        Args: {
          p_avatar_url: string;
          p_full_name: string;
          p_job_title: string;
          p_timezone: string;
        };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      create_workspace: {
        Args: { p_name: string; p_slug: string };
        Returns: Database["public"]["Tables"]["workspaces"]["Row"];
      };
      handle_base_from_email: { Args: { p_email: string }; Returns: string };
      is_handle_available: { Args: { p_handle: string }; Returns: boolean };
      is_slug_available: { Args: { p_slug: string }; Returns: boolean };
      is_workspace_admin: { Args: { ws: string }; Returns: boolean };
      is_workspace_member: { Args: { ws: string }; Returns: boolean };
      set_last_workspace: { Args: { p_workspace: string }; Returns: undefined };
      shares_workspace_with: { Args: { other: string }; Returns: boolean };
      workspace_role_of: {
        Args: { ws: string };
        Returns: Database["public"]["Enums"]["workspace_role"];
      };
    };
    Enums: {
      invite_status: "active" | "revoked" | "exhausted" | "expired";
      milestone_status: "open" | "completed";
      notification_type:
        | "task_assigned"
        | "mentioned"
        | "comment_on_assigned"
        | "status_changed_on_assigned"
        | "due_soon"
        | "overdue"
        | "invited_to_project"
        | "achievement_unlocked"
        | "rebalance_suggested";
      project_role: "lead" | "contributor" | "viewer";
      project_status: "planning" | "active" | "on_hold" | "completed" | "archived";
      project_visibility: "workspace" | "private";
      task_priority: "urgent" | "high" | "medium" | "low" | "none";
      task_status: "backlog" | "todo" | "in_progress" | "in_review" | "done" | "cancelled";
      workspace_role: "owner" | "admin" | "member" | "guest";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
