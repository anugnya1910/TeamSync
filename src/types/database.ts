// Database types in the `supabase gen types typescript` format.
// Generated from the migrations (CI regenerates this file with the Supabase CLI and re-runs the
// typecheck to detect drift). Do not edit by hand — run `npm run gen:types` with a local stack.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      achievements: {
        Row: {
          code: string;
          description: string;
          icon: string;
          name: string;
          xp_reward: number;
        };
        Insert: {
          code: string;
          description: string;
          icon: string;
          name: string;
          xp_reward?: number;
        };
        Update: {
          code?: string;
          description?: string;
          icon?: string;
          name?: string;
          xp_reward?: number;
        };
        Relationships: [];
      };
      activity_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: number;
          metadata: Json;
          project_id: string | null;
          task_id: string | null;
          workspace_id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: number;
          metadata?: Json;
          project_id?: string | null;
          task_id?: string | null;
          workspace_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: number;
          metadata?: Json;
          project_id?: string | null;
          task_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_logs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_logs_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_logs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_requests: {
        Row: {
          action: string;
          created_at: string;
          id: string;
          input_tokens: number | null;
          latency_ms: number | null;
          output_tokens: number | null;
          source: string;
          status: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: string;
          input_tokens?: number | null;
          latency_ms?: number | null;
          output_tokens?: number | null;
          source: string;
          status: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: string;
          input_tokens?: number | null;
          latency_ms?: number | null;
          output_tokens?: number | null;
          source?: string;
          status?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_requests_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      attachments: {
        Row: {
          comment_id: string | null;
          created_at: string;
          file_name: string;
          id: string;
          mime_type: string;
          project_id: string;
          size_bytes: number;
          storage_path: string;
          task_id: string;
          uploaded_by: string | null;
          workspace_id: string;
        };
        Insert: {
          comment_id?: string | null;
          created_at?: string;
          file_name: string;
          id?: string;
          mime_type: string;
          project_id: string;
          size_bytes: number;
          storage_path: string;
          task_id: string;
          uploaded_by?: string | null;
          workspace_id: string;
        };
        Update: {
          comment_id?: string | null;
          created_at?: string;
          file_name?: string;
          id?: string;
          mime_type?: string;
          project_id?: string;
          size_bytes?: number;
          storage_path?: string;
          task_id?: string;
          uploaded_by?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attachments_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attachments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      comment_mentions: {
        Row: {
          comment_id: string;
          user_id: string;
        };
        Insert: {
          comment_id: string;
          user_id: string;
        };
        Update: {
          comment_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comment_mentions_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comment_mentions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          project_id: string;
          task_id: string;
          workspace_id: string;
        };
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          project_id: string;
          task_id: string;
          workspace_id: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          project_id?: string;
          task_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      labels: {
        Row: {
          color: string;
          id: string;
          name: string;
          project_id: string;
          workspace_id: string;
        };
        Insert: {
          color?: string;
          id?: string;
          name: string;
          project_id: string;
          workspace_id: string;
        };
        Update: {
          color?: string;
          id?: string;
          name?: string;
          project_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "labels_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      milestones: {
        Row: {
          created_at: string;
          description: string | null;
          due_date: string | null;
          id: string;
          name: string;
          project_id: string;
          sort_order: number;
          status: Database["public"]["Enums"]["milestone_status"];
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          name: string;
          project_id: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["milestone_status"];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          name?: string;
          project_id?: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["milestone_status"];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          body: string | null;
          created_at: string;
          entity_id: string | null;
          id: string;
          link: string | null;
          read_at: string | null;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          actor_id?: string | null;
          body?: string | null;
          created_at?: string;
          entity_id?: string | null;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
          workspace_id: string;
        };
        Update: {
          actor_id?: string | null;
          body?: string | null;
          created_at?: string;
          entity_id?: string | null;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          type?: Database["public"]["Enums"]["notification_type"];
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
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
      project_health_snapshots: {
        Row: {
          band: string;
          blocked_tasks: number;
          completed_effort: number;
          created_at: string;
          factors: Json;
          id: string;
          open_tasks: number;
          overdue_tasks: number;
          project_id: string;
          remaining_effort: number;
          score: number | null;
          snapshot_date: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          band: string;
          blocked_tasks?: number;
          completed_effort?: number;
          created_at?: string;
          factors?: Json;
          id?: string;
          open_tasks?: number;
          overdue_tasks?: number;
          project_id: string;
          remaining_effort?: number;
          score?: number | null;
          snapshot_date: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          band?: string;
          blocked_tasks?: number;
          completed_effort?: number;
          created_at?: string;
          factors?: Json;
          id?: string;
          open_tasks?: number;
          overdue_tasks?: number;
          project_id?: string;
          remaining_effort?: number;
          score?: number | null;
          snapshot_date?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_health_snapshots_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_health_snapshots_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      project_members: {
        Row: {
          added_at: string;
          project_id: string;
          role: Database["public"]["Enums"]["project_role"];
          user_id: string;
          weekly_capacity_points: number;
          workspace_id: string;
        };
        Insert: {
          added_at?: string;
          project_id: string;
          role?: Database["public"]["Enums"]["project_role"];
          user_id: string;
          weekly_capacity_points?: number;
          workspace_id: string;
        };
        Update: {
          added_at?: string;
          project_id?: string;
          role?: Database["public"]["Enums"]["project_role"];
          user_id?: string;
          weekly_capacity_points?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_members_workspace_id_user_id_fkey";
            columns: ["user_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspace_members";
            referencedColumns: ["workspace_id", "user_id"];
          },
        ];
      };
      projects: {
        Row: {
          color: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          icon: string | null;
          id: string;
          key: string;
          name: string;
          start_date: string | null;
          status: Database["public"]["Enums"]["project_status"];
          target_date: string | null;
          task_counter: number;
          team_id: string | null;
          updated_at: string;
          visibility: Database["public"]["Enums"]["project_visibility"];
          wip_limits: Json;
          workspace_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          icon?: string | null;
          id?: string;
          key: string;
          name: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          target_date?: string | null;
          task_counter?: number;
          team_id?: string | null;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["project_visibility"];
          wip_limits?: Json;
          workspace_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          icon?: string | null;
          id?: string;
          key?: string;
          name?: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          target_date?: string | null;
          task_counter?: number;
          team_id?: string | null;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["project_visibility"];
          wip_limits?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_views: {
        Row: {
          created_at: string;
          filters: Json;
          id: string;
          name: string;
          project_id: string;
          user_id: string;
          view_type: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          filters?: Json;
          id?: string;
          name: string;
          project_id: string;
          user_id?: string;
          view_type: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          filters?: Json;
          id?: string;
          name?: string;
          project_id?: string;
          user_id?: string;
          view_type?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_views_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_views_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_assignees: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          project_id: string;
          task_id: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          project_id: string;
          task_id: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          project_id?: string;
          task_id?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_assignees_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_assignees_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_dependencies: {
        Row: {
          blocked_task_id: string;
          blocker_task_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          project_id: string;
          workspace_id: string;
        };
        Insert: {
          blocked_task_id: string;
          blocker_task_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          project_id: string;
          workspace_id: string;
        };
        Update: {
          blocked_task_id?: string;
          blocker_task_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          project_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_dependencies_blocked_task_id_fkey";
            columns: ["blocked_task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_dependencies_blocker_task_id_fkey";
            columns: ["blocker_task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_dependencies_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_labels: {
        Row: {
          label_id: string;
          project_id: string;
          task_id: string;
          workspace_id: string;
        };
        Insert: {
          label_id: string;
          project_id: string;
          task_id: string;
          workspace_id: string;
        };
        Update: {
          label_id?: string;
          project_id?: string;
          task_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_labels_label_id_fkey";
            columns: ["label_id"];
            isOneToOne: false;
            referencedRelation: "labels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_labels_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      task_status_history: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          effort_points: number | null;
          from_status: Database["public"]["Enums"]["task_status"] | null;
          id: number;
          project_id: string;
          task_id: string;
          to_status: Database["public"]["Enums"]["task_status"];
          workspace_id: string;
        };
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          effort_points?: number | null;
          from_status?: Database["public"]["Enums"]["task_status"] | null;
          id?: number;
          project_id: string;
          task_id: string;
          to_status: Database["public"]["Enums"]["task_status"];
          workspace_id: string;
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          effort_points?: number | null;
          from_status?: Database["public"]["Enums"]["task_status"] | null;
          id?: number;
          project_id?: string;
          task_id?: string;
          to_status?: Database["public"]["Enums"]["task_status"];
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_status_history_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          blocked_reason: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          due_date: string | null;
          effort_points: number | null;
          id: string;
          is_blocked: boolean;
          milestone_id: string | null;
          number: number;
          parent_task_id: string | null;
          position: number;
          priority: Database["public"]["Enums"]["task_priority"];
          project_id: string;
          search_vector: unknown | null;
          start_date: string | null;
          status: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          blocked_reason?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          due_date?: string | null;
          effort_points?: number | null;
          id?: string;
          is_blocked?: boolean;
          milestone_id?: string | null;
          number: number;
          parent_task_id?: string | null;
          position: number;
          priority?: Database["public"]["Enums"]["task_priority"];
          project_id: string;
          search_vector?: never;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          blocked_reason?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          due_date?: string | null;
          effort_points?: number | null;
          id?: string;
          is_blocked?: boolean;
          milestone_id?: string | null;
          number?: number;
          parent_task_id?: string | null;
          position?: number;
          priority?: Database["public"]["Enums"]["task_priority"];
          project_id?: string;
          search_vector?: never;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_milestone_id_fkey";
            columns: ["milestone_id"];
            isOneToOne: false;
            referencedRelation: "milestones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey";
            columns: ["parent_task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      team_members: {
        Row: {
          added_at: string;
          team_id: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          added_at?: string;
          team_id: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          added_at?: string;
          team_id?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_members_workspace_id_user_id_fkey";
            columns: ["user_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspace_members";
            referencedColumns: ["workspace_id", "user_id"];
          },
        ];
      };
      teams: {
        Row: {
          color: string;
          created_at: string;
          created_by: string | null;
          icon: string;
          id: string;
          name: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          created_by?: string | null;
          icon?: string;
          id?: string;
          name: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          created_by?: string | null;
          icon?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teams_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teams_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      user_achievements: {
        Row: {
          achievement_code: string;
          unlocked_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          achievement_code: string;
          unlocked_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          achievement_code?: string;
          unlocked_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_code_fkey";
            columns: ["achievement_code"];
            isOneToOne: false;
            referencedRelation: "achievements";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_achievements_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      user_streaks: {
        Row: {
          current_streak: number;
          last_active_date: string | null;
          longest_streak: number;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          current_streak?: number;
          last_active_date?: string | null;
          longest_streak?: number;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          current_streak?: number;
          last_active_date?: string | null;
          longest_streak?: number;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_streaks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_streaks_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workload_recommendations: {
        Row: {
          created_at: string;
          details: Json;
          from_user_id: string;
          id: string;
          imbalance_after: number;
          imbalance_before: number;
          project_id: string;
          reason: string;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string;
          task_id: string;
          to_user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          details?: Json;
          from_user_id: string;
          id?: string;
          imbalance_after: number;
          imbalance_before: number;
          project_id: string;
          reason: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          task_id: string;
          to_user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          details?: Json;
          from_user_id?: string;
          id?: string;
          imbalance_after?: number;
          imbalance_before?: number;
          project_id?: string;
          reason?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          task_id?: string;
          to_user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workload_recommendations_from_user_id_fkey";
            columns: ["from_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workload_recommendations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workload_recommendations_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workload_recommendations_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workload_recommendations_to_user_id_fkey";
            columns: ["to_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workload_recommendations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_invitations: {
        Row: {
          created_at: string;
          email: string | null;
          expires_at: string;
          id: string;
          invited_by: string | null;
          max_uses: number;
          role: Database["public"]["Enums"]["workspace_role"];
          status: Database["public"]["Enums"]["invite_status"];
          token_hash: string;
          use_count: number;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          max_uses?: number;
          role?: Database["public"]["Enums"]["workspace_role"];
          status?: Database["public"]["Enums"]["invite_status"];
          token_hash: string;
          use_count?: number;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          max_uses?: number;
          role?: Database["public"]["Enums"]["workspace_role"];
          status?: Database["public"]["Enums"]["invite_status"];
          token_hash?: string;
          use_count?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey";
            columns: ["workspace_id"];
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
            isOneToOne: true;
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
      xp_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: number;
          metadata: Json;
          source_id: string;
          source_type: string;
          user_id: string;
          workspace_id: string;
          xp: number;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: number;
          metadata?: Json;
          source_id: string;
          source_type: string;
          user_id: string;
          workspace_id: string;
          xp: number;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: number;
          metadata?: Json;
          source_id?: string;
          source_type?: string;
          user_id?: string;
          workspace_id?: string;
          xp?: number;
        };
        Relationships: [
          {
            foreignKeyName: "xp_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "xp_events_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_member_stats: {
        Row: {
          current_streak: number | null;
          level: number | null;
          longest_streak: number | null;
          on_time_count: number | null;
          tasks_completed: number | null;
          total_xp: number | null;
          user_id: string | null;
          workspace_id: string | null;
        };
        Relationships: [];
      };
      v_task_effective: {
        Row: {
          blocked_reason: string | null;
          blocking_open_count: number | null;
          completed_at: string | null;
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          due_date: string | null;
          effectively_blocked: boolean | null;
          effort_points: number | null;
          id: string | null;
          is_blocked: boolean | null;
          milestone_id: string | null;
          number: number | null;
          open_blocker_count: number | null;
          parent_task_id: string | null;
          position: number | null;
          priority: Database["public"]["Enums"]["task_priority"] | null;
          project_id: string | null;
          search_vector: unknown | null;
          start_date: string | null;
          status: Database["public"]["Enums"]["task_status"] | null;
          title: string | null;
          updated_at: string | null;
          workspace_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      _unassign_open_tasks: { Args: { p_workspace: string; p_user: string }; Returns: undefined };
      accept_invitation: { Args: { p_token: string }; Returns: Database["public"]["Tables"]["workspaces"]["Row"] };
      active_projects_page: { Args: { p_after: string; p_limit?: number }; Returns: {
          id: string;
          workspace_id: string;
        }[] };
      actor_name: { Args: never; Returns: string };
      ai_day_start: { Args: never; Returns: string };
      ai_requests_today_global: { Args: never; Returns: number };
      apply_workload_recommendation: { Args: { p_id: string }; Returns: Database["public"]["Tables"]["tasks"]["Row"] };
      bulk_update_tasks: { Args: { p_ids: string[]; p_patch: Json }; Returns: number };
      can_edit_project_content: { Args: { p: string }; Returns: boolean };
      can_view_project: { Args: { p: string }; Returns: boolean };
      change_member_role: { Args: { p_workspace: string; p_user: string; p_role: Database["public"]["Enums"]["workspace_role"] }; Returns: undefined };
      check_achievements: { Args: { p_user: string; p_workspace: string }; Returns: undefined };
      complete_onboarding: { Args: { p_full_name: string; p_job_title: string; p_timezone: string; p_avatar_url: string }; Returns: Database["public"]["Tables"]["profiles"]["Row"] };
      consume_ai_quota: { Args: { p_workspace: string; p_action: string }; Returns: {
          allowed: boolean;
          reason: string;
          user_remaining: number;
          workspace_remaining: number;
          request_id: string;
        }[] };
      create_invitation: { Args: { p_workspace: string; p_role: Database["public"]["Enums"]["workspace_role"]; p_email?: string; p_max_uses?: number; p_expires_days?: number }; Returns: {
          invitation_id: string;
          token: string;
        }[] };
      create_project: { Args: { p_workspace: string; p_name: string; p_key: string; p_description?: string; p_visibility?: Database["public"]["Enums"]["project_visibility"]; p_start?: string; p_target?: string; p_team?: string; p_template?: string; p_icon?: string; p_color?: string }; Returns: Database["public"]["Tables"]["projects"]["Row"] };
      create_workspace: { Args: { p_name: string; p_slug: string }; Returns: Database["public"]["Tables"]["workspaces"]["Row"] };
      delete_project: { Args: { p_project: string }; Returns: undefined };
      delete_task: { Args: { p_task: string }; Returns: undefined };
      delete_workspace: { Args: { p_workspace: string; p_confirm_slug: string }; Returns: undefined };
      dismiss_workload_recommendation: { Args: { p_id: string }; Returns: undefined };
      duplicate_task: { Args: { p_task: string }; Returns: Database["public"]["Tables"]["tasks"]["Row"] };
      extract_mention_handles: { Args: { p_body: string }; Returns: string[] };
      finish_ai_request: { Args: { p_id: string; p_source: string; p_status: string; p_in: number; p_out: number; p_latency: number }; Returns: undefined };
      gamification_on: { Args: { p_workspace: string }; Returns: boolean };
      generate_due_notifications: { Args: { p_date: string }; Returns: {
          due_soon: number;
          overdue: number;
        }[] };
      get_invitation_preview: { Args: { p_token: string }; Returns: {
          workspace_name: string;
          workspace_slug: string;
          role: Database["public"]["Enums"]["workspace_role"];
          inviter_name: string;
          status: Database["public"]["Enums"]["invite_status"];
          expires_at: string;
          email_bound: boolean;
          already_member: boolean;
        }[] };
      get_leaderboard: { Args: { p_workspace: string; p_period?: string }; Returns: {
          user_id: string;
          full_name: string;
          avatar_url: string;
          xp: number;
          level: number;
          current_streak: number;
          tasks_completed: number;
          rank: number;
          is_self: boolean;
        }[] };
      handle_base_from_email: { Args: { p_email: string }; Returns: string };
      hash_invite_token: { Args: { p_token: string }; Returns: string };
      health_check: { Args: never; Returns: string };
      insert_xp: { Args: { p_workspace: string; p_user: string; p_source_type: string; p_source: string; p_event: string; p_xp: number; p_meta?: Json }; Returns: number };
      invitation_effective_status: { Args: { i: string }; Returns: Database["public"]["Enums"]["invite_status"] };
      is_handle_available: { Args: { p_handle: string }; Returns: boolean };
      is_project_key_available: { Args: { p_workspace: string; p_key: string }; Returns: boolean };
      is_project_lead: { Args: { p: string }; Returns: boolean };
      is_service_role: { Args: never; Returns: boolean };
      is_slug_available: { Args: { p_slug: string }; Returns: boolean };
      is_workspace_admin: { Args: { ws: string }; Returns: boolean };
      is_workspace_member: { Args: { ws: string }; Returns: boolean };
      leave_workspace: { Args: { p_workspace: string }; Returns: undefined };
      level_for_xp: { Args: { p_xp: number }; Returns: number };
      log_activity: { Args: { p_workspace: string; p_project: string; p_task: string; p_action: string; p_entity_type: string; p_entity_id: string; p_metadata: Json }; Returns: undefined };
      log_ai_applied: { Args: { p_project: string; p_kind: string; p_count: number }; Returns: undefined };
      log_ai_fallback: { Args: { p_workspace: string; p_action: string; p_status: string }; Returns: string };
      mark_all_notifications_read: { Args: { p_workspace?: string }; Returns: number };
      move_task: { Args: { p_task: string; p_status: Database["public"]["Enums"]["task_status"]; p_before?: number; p_after?: number; p_override_reason?: string; p_client_mutation_id?: string }; Returns: Database["public"]["Tables"]["tasks"]["Row"] };
      notify: { Args: { p_user: string; p_workspace: string; p_type: Database["public"]["Enums"]["notification_type"]; p_title: string; p_body: string; p_link: string; p_entity: string }; Returns: undefined };
      project_role_of: { Args: { p: string }; Returns: Database["public"]["Enums"]["project_role"] };
      project_template: { Args: { p_template: string }; Returns: Json };
      prune_old_data: { Args: never; Returns: {
          activity_deleted: number;
          notifications_deleted: number;
          ai_requests_deleted: number;
        }[] };
      remove_member: { Args: { p_workspace: string; p_user: string }; Returns: undefined };
      remove_project_member: { Args: { p_project: string; p_user: string }; Returns: undefined };
      restore_project: { Args: { p_project: string }; Returns: undefined };
      restore_task: { Args: { p_task: string }; Returns: undefined };
      revoke_invitation: { Args: { p_id: string }; Returns: undefined };
      save_workload_recommendations: { Args: { p_project: string; p_items: Json }; Returns: number };
      search_workspace: { Args: { p_workspace: string; p_query: string; p_limit?: number }; Returns: {
          kind: string;
          id: string;
          title: string;
          subtitle: string;
          url: string;
          rank: number;
        }[] };
      set_last_workspace: { Args: { p_workspace: string }; Returns: undefined };
      set_project_archived: { Args: { p_project: string; p_archived: boolean }; Returns: Database["public"]["Tables"]["projects"]["Row"] };
      set_project_member: { Args: { p_project: string; p_user: string; p_role?: Database["public"]["Enums"]["project_role"]; p_capacity?: number }; Returns: undefined };
      set_task_assignees: { Args: { p_task: string; p_users: string[] }; Returns: undefined };
      set_task_labels: { Args: { p_task: string; p_labels: string[] }; Returns: undefined };
      set_team_members: { Args: { p_team: string; p_users: string[] }; Returns: undefined };
      shares_workspace_with: { Args: { other: string }; Returns: boolean };
      task_effectively_blocked: { Args: { p_task: string }; Returns: boolean };
      task_has_open_blockers: { Args: { p_task: string }; Returns: boolean };
      task_key: { Args: { p_task: string }; Returns: string };
      task_link: { Args: { p_task: string }; Returns: string };
      transfer_ownership: { Args: { p_workspace: string; p_new_owner: string }; Returns: undefined };
      try_uuid: { Args: { p: string }; Returns: string };
      update_streak: { Args: { p_user: string; p_workspace: string }; Returns: undefined };
      upsert_health_snapshot: { Args: { p_project: string; p_date: string; p_score: number; p_band: string; p_factors: Json; p_stats: Json }; Returns: Database["public"]["Tables"]["project_health_snapshots"]["Row"] };
      user_local_date: { Args: { p_user: string }; Returns: string };
      workspace_role_of: { Args: { ws: string }; Returns: Database["public"]["Enums"]["workspace_role"] };
    };
    Enums: {
      invite_status: "active" | "revoked" | "exhausted" | "expired";
      milestone_status: "open" | "completed";
      notification_type: "task_assigned" | "mentioned" | "comment_on_assigned" | "status_changed_on_assigned" | "due_soon" | "overdue" | "invited_to_project" | "achievement_unlocked" | "rebalance_suggested";
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

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never;
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
