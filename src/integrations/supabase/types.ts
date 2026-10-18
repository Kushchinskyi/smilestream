export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

import type {
  VideoCategory,
  DictionaryEntry,
  VideoTag,
  VideoClassification,
  TagRelation,
} from "@/lib/video-taxonomy";
type TaxonomyTable<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};
export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      video_categories: TaxonomyTable<VideoCategory>;
      video_content_formats: TaxonomyTable<DictionaryEntry>;
      video_tags: TaxonomyTable<VideoTag>;
      video_classification: TaxonomyTable<VideoClassification>;
      video_tag_relations: TaxonomyTable<TagRelation>;
      music_profiles: {
        Row: {
          id: string;
          name: string;
          description: string;
          is_active: boolean;
          is_default: boolean;
          sort_order: number;
          volume_override: number | null;
          track_urls: string[];
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          is_active?: boolean;
          is_default?: boolean;
          sort_order?: number;
          volume_override?: number | null;
          track_urls?: string[];
        };
        Update: {
          name?: string;
          description?: string;
          is_active?: boolean;
          is_default?: boolean;
          sort_order?: number;
          volume_override?: number | null;
          track_urls?: string[];
        };
        Relationships: [];
      };
      ad_playback_settings: {
        Row: { id: number; enabled: boolean; interval_minutes: number; block_count: number };
        Insert: { id?: number; enabled?: boolean; interval_minutes?: number; block_count?: number };
        Update: { enabled?: boolean; interval_minutes?: number; block_count?: number };
        Relationships: [];
      };
      advertisements: {
        Row: {
          cover_url: string;
          id: string;
          title: string;
          url: string;
          duration_seconds: number;
          sort_order: number;
          is_active: boolean;
          original_sound: boolean;
          created_at: string;
        };
        Insert: {
          cover_url?: string;
          id?: string;
          title: string;
          url: string;
          duration_seconds?: number;
          sort_order?: number;
          is_active?: boolean;
          original_sound?: boolean;
        };
        Update: {
          cover_url?: string;
          title?: string;
          url?: string;
          duration_seconds?: number;
          sort_order?: number;
          is_active?: boolean;
          original_sound?: boolean;
        };
        Relationships: [];
      };
      media_metadata: {
        Row: {
          kind: string;
          source_key: string;
          label: string;
          category: string;
          cover_url: string;
        };
        Insert: {
          kind: string;
          source_key: string;
          label?: string;
          category?: string;
          cover_url?: string;
        };
        Update: { label?: string; category?: string; cover_url?: string };
        Relationships: [];
      };
      playback_settings: {
        Row: {
          id: number;
          music_urls: string[];
          music_volume: number;
          video_volume: number;
          duck_volume: number;
          original_video_ids: string[];
        };
        Insert: {
          id?: number;
          music_urls?: string[];
          music_volume?: number;
          video_volume?: number;
          duck_volume?: number;
          original_video_ids?: string[];
        };
        Update: {
          music_urls?: string[];
          music_volume?: number;
          video_volume?: number;
          duck_volume?: number;
          original_video_ids?: string[];
        };
        Relationships: [];
      };
      screens: {
        Row: {
          last_selected_music_profile_id: string | null;
          default_music_profile_id: string | null;
          created_at: string;
          diagonal_inches: number | null;
          id: string;
          last_heartbeat_at: string | null;
          name: string;
          pairing_code: string | null;
        };
        Insert: {
          last_selected_music_profile_id?: string | null;
          default_music_profile_id?: string | null;
          created_at?: string;
          diagonal_inches?: number | null;
          id?: string;
          last_heartbeat_at?: string | null;
          name: string;
          pairing_code?: string | null;
        };
        Update: {
          last_selected_music_profile_id?: string | null;
          default_music_profile_id?: string | null;
          created_at?: string;
          diagonal_inches?: number | null;
          id?: string;
          last_heartbeat_at?: string | null;
          name?: string;
          pairing_code?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      videos: {
        Row: {
          created_at: string;
          duration_seconds: number;
          id: string;
          is_active: boolean;
          is_test: boolean;
          sort_order: number;
          title: string;
          updated_at: string;
          url: string;
        };
        Insert: {
          created_at?: string;
          duration_seconds?: number;
          id?: string;
          is_active?: boolean;
          is_test?: boolean;
          sort_order?: number;
          title: string;
          updated_at?: string;
          url: string;
        };
        Update: {
          created_at?: string;
          duration_seconds?: number;
          id?: string;
          is_active?: boolean;
          is_test?: boolean;
          sort_order?: number;
          title?: string;
          updated_at?: string;
          url?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      classify_videos: { Args: { p_ids: string[]; p_patch: Json }; Returns: undefined };
      merge_video_tags: { Args: { p_source: string; p_target: string }; Returns: undefined };
      delete_video_records: {
        Args: { p_ids: string[]; p_confirmation: string };
        Returns: undefined;
      };
      save_music_profile: { Args: { profile: Json }; Returns: string };
      reorder_music_profiles: { Args: { ordered_ids: string[] }; Returns: undefined };
      read_ad_playback: { Args: Record<string, never>; Returns: Json };
      reorder_advertisements: { Args: { ordered_ids: string[] }; Returns: undefined };
      reorder_videos: { Args: { ordered_ids: string[] }; Returns: undefined };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const;
