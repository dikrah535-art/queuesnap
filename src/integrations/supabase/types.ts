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
  public: {
    Tables: {
      devices: {
        Row: {
          called_time: string | null
          check_in_time: string
          collection_time: string | null
          created_at: string
          id: string
          owner_email: string | null
          owner_id_text: string | null
          owner_name: string
          owner_user_id: string | null
          phone_model: string | null
          photo_url: string | null
          queue_time: string | null
          ringing: boolean
          slot_id: string | null
          slot_label: string | null
          status: Database["public"]["Enums"]["device_status"]
          token_code: string
        }
        Insert: {
          called_time?: string | null
          check_in_time?: string
          collection_time?: string | null
          created_at?: string
          id?: string
          owner_email?: string | null
          owner_id_text?: string | null
          owner_name: string
          owner_user_id?: string | null
          phone_model?: string | null
          photo_url?: string | null
          queue_time?: string | null
          ringing?: boolean
          slot_id?: string | null
          slot_label?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          token_code?: string
        }
        Update: {
          called_time?: string | null
          check_in_time?: string
          collection_time?: string | null
          created_at?: string
          id?: string
          owner_email?: string | null
          owner_id_text?: string | null
          owner_name?: string
          owner_user_id?: string | null
          phone_model?: string | null
          photo_url?: string | null
          queue_time?: string | null
          ringing?: boolean
          slot_id?: string | null
          slot_label?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          token_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["id"]
          },
        ]
      }
      lobbies: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          max_capacity: number
          name: string
          status: Database["public"]["Enums"]["lobby_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          max_capacity?: number
          name: string
          status?: Database["public"]["Enums"]["lobby_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          max_capacity?: number
          name?: string
          status?: Database["public"]["Enums"]["lobby_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lobbies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      queue_entries: {
        Row: {
          created_at: string
          device_type: string | null
          id: string
          lobby_id: string
          name: string
          phone: string | null
          position: number
          served_at: string | null
          status: Database["public"]["Enums"]["queue_entry_status"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          id?: string
          lobby_id: string
          name: string
          phone?: string | null
          position: number
          served_at?: string | null
          status?: Database["public"]["Enums"]["queue_entry_status"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_type?: string | null
          id?: string
          lobby_id?: string
          name?: string
          phone?: string | null
          position?: number
          served_at?: string | null
          status?: Database["public"]["Enums"]["queue_entry_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_entries_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          },
        ]
      }
      slots: {
        Row: {
          created_at: string
          id: string
          is_occupied: boolean
          label: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_occupied?: boolean
          label: string
        }
        Update: {
          created_at?: string
          id?: string
          is_occupied?: boolean
          label?: string
        }
        Relationships: []
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
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          default_capacity: number
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_capacity?: number
          description?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          default_capacity?: number
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ack_ring: { Args: { _id: string; _token: string }; Returns: boolean }
      add_workspace_admin_by_email: {
        Args: { _email: string; _workspace_id: string }
        Returns: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "workspace_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_next_slot: {
        Args: never
        Returns: {
          slot_id: string
          slot_label: string
        }[]
      }
      clear_queue: { Args: { _lobby_id: string }; Returns: number }
      fetch_lobby_entries_admin: {
        Args: { _include_all?: boolean; _lobby_id: string }
        Returns: {
          created_at: string
          device_type: string | null
          id: string
          lobby_id: string
          name: string
          phone: string | null
          position: number
          served_at: string | null
          status: Database["public"]["Enums"]["queue_entry_status"]
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "queue_entries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_workspace_admin: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_owner: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      join_lobby:
        | {
            Args: { _lobby_id: string; _name: string; _user_id?: string }
            Returns: {
              created_at: string
              device_type: string | null
              id: string
              lobby_id: string
              name: string
              phone: string | null
              position: number
              served_at: string | null
              status: Database["public"]["Enums"]["queue_entry_status"]
              user_id: string | null
            }
            SetofOptions: {
              from: "*"
              to: "queue_entries"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _device_type?: string
              _lobby_id: string
              _name: string
              _phone?: string
              _user_id?: string
            }
            Returns: {
              created_at: string
              device_type: string | null
              id: string
              lobby_id: string
              name: string
              phone: string | null
              position: number
              served_at: string | null
              status: Database["public"]["Enums"]["queue_entry_status"]
              user_id: string | null
            }
            SetofOptions: {
              from: "*"
              to: "queue_entries"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      join_queue: { Args: { _id: string; _token: string }; Returns: boolean }
      lookup_device: {
        Args: { _token: string }
        Returns: {
          id: string
          owner_name: string
          phone_model: string
          ringing: boolean
          slot_label: string
          status: Database["public"]["Enums"]["device_status"]
          token_code: string
        }[]
      }
      mark_collected: {
        Args: { _entry_id: string }
        Returns: {
          created_at: string
          device_type: string | null
          id: string
          lobby_id: string
          name: string
          phone: string | null
          position: number
          served_at: string | null
          status: Database["public"]["Enums"]["queue_entry_status"]
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "queue_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      queue_position: { Args: { _id: string; _token: string }; Returns: number }
      serve_next: {
        Args: { _lobby_id: string }
        Returns: {
          created_at: string
          device_type: string | null
          id: string
          lobby_id: string
          name: string
          phone: string | null
          position: number
          served_at: string | null
          status: Database["public"]["Enums"]["queue_entry_status"]
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "queue_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "user" | "owner"
      device_status: "checked_in" | "in_queue" | "called" | "collected"
      lobby_status: "open" | "closed"
      queue_entry_status:
        | "waiting"
        | "serving"
        | "served"
        | "cancelled"
        | "collected"
      workspace_role: "owner" | "admin" | "member"
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
      app_role: ["admin", "user", "owner"],
      device_status: ["checked_in", "in_queue", "called", "collected"],
      lobby_status: ["open", "closed"],
      queue_entry_status: [
        "waiting",
        "serving",
        "served",
        "cancelled",
        "collected",
      ],
      workspace_role: ["owner", "admin", "member"],
    },
  },
} as const
