export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      trips: {
        Row: {
          id: string;
          name: string;
          destination: string;
          start_date: string;
          end_date: string;
          location_type: Database["public"]["Enums"]["location_type"];
          cover_url: string | null;
          invite_code: string;
          base_currency: string;
          owner_member_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          destination: string;
          start_date: string;
          end_date: string;
          location_type?: Database["public"]["Enums"]["location_type"];
          cover_url?: string | null;
          invite_code: string;
          base_currency?: string;
          owner_member_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          destination?: string;
          start_date?: string;
          end_date?: string;
          location_type?: Database["public"]["Enums"]["location_type"];
          cover_url?: string | null;
          invite_code?: string;
          base_currency?: string;
          owner_member_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trips_owner_member_id_fkey";
            columns: ["owner_member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      members: {
        Row: {
          id: string;
          trip_id: string;
          traveler_id: string | null;
          display_name: string;
          pin_hash: string;
          role: Database["public"]["Enums"]["member_role"];
          payment_qr_path: string | null;
          upi_id: string | null;
          failed_attempts: number;
          locked_until: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          traveler_id?: string | null;
          display_name: string;
          pin_hash: string;
          role?: Database["public"]["Enums"]["member_role"];
          payment_qr_path?: string | null;
          upi_id?: string | null;
          failed_attempts?: number;
          locked_until?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          traveler_id?: string | null;
          display_name?: string;
          pin_hash?: string;
          role?: Database["public"]["Enums"]["member_role"];
          payment_qr_path?: string | null;
          upi_id?: string | null;
          failed_attempts?: number;
          locked_until?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "members_traveler_id_fkey";
            columns: ["traveler_id"];
            isOneToOne: false;
            referencedRelation: "travelers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "members_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      travelers: {
        Row: {
          id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      places: {
        Row: {
          id: string;
          trip_id: string;
          name: string;
          lat: number;
          lng: number;
          category: string | null;
          location_type: Database["public"]["Enums"]["location_type"] | null;
          proposed_by: string | null;
          status: Database["public"]["Enums"]["place_status"];
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          name: string;
          lat: number;
          lng: number;
          category?: string | null;
          location_type?: Database["public"]["Enums"]["location_type"] | null;
          proposed_by?: string | null;
          status?: Database["public"]["Enums"]["place_status"];
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          name?: string;
          lat?: number;
          lng?: number;
          category?: string | null;
          location_type?: Database["public"]["Enums"]["location_type"] | null;
          proposed_by?: string | null;
          status?: Database["public"]["Enums"]["place_status"];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "places_proposed_by_fkey";
            columns: ["proposed_by"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "places_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      itinerary_items: {
        Row: {
          id: string;
          trip_id: string;
          day_index: number;
          position: number;
          title: string;
          start_time: string | null;
          place_id: string | null;
          notes: string | null;
          location_type: Database["public"]["Enums"]["location_type"] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          day_index: number;
          position?: number;
          title: string;
          start_time?: string | null;
          place_id?: string | null;
          notes?: string | null;
          location_type?: Database["public"]["Enums"]["location_type"] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          day_index?: number;
          position?: number;
          title?: string;
          start_time?: string | null;
          place_id?: string | null;
          notes?: string | null;
          location_type?: Database["public"]["Enums"]["location_type"] | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "itinerary_items_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "itinerary_items_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      place_votes: {
        Row: {
          place_id: string;
          member_id: string;
          value: number;
          created_at: string;
        };
        Insert: {
          place_id: string;
          member_id: string;
          value: number;
          created_at?: string;
        };
        Update: {
          place_id?: string;
          member_id?: string;
          value?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "place_votes_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "place_votes_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          trip_id: string;
          uploader_id: string;
          title: string;
          type: Database["public"]["Enums"]["document_type"];
          storage_path: string;
          itinerary_item_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          uploader_id: string;
          title: string;
          type?: Database["public"]["Enums"]["document_type"];
          storage_path: string;
          itinerary_item_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          uploader_id?: string;
          title?: string;
          type?: Database["public"]["Enums"]["document_type"];
          storage_path?: string;
          itinerary_item_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_itinerary_item_id_fkey";
            columns: ["itinerary_item_id"];
            isOneToOne: false;
            referencedRelation: "itinerary_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_uploader_id_fkey";
            columns: ["uploader_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      packing_items: {
        Row: {
          id: string;
          trip_id: string;
          name: string;
          category: Database["public"]["Enums"]["packing_category"];
          is_shared: boolean;
          assigned_to: string | null;
          checked: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          name: string;
          category?: Database["public"]["Enums"]["packing_category"];
          is_shared?: boolean;
          assigned_to?: string | null;
          checked?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          name?: string;
          category?: Database["public"]["Enums"]["packing_category"];
          is_shared?: boolean;
          assigned_to?: string | null;
          checked?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "packing_items_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "packing_items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "packing_items_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      budgets: {
        Row: {
          trip_id: string;
          total_paise: number;
          category_caps: Json;
        };
        Insert: {
          trip_id: string;
          total_paise?: number;
          category_caps?: Json;
        };
        Update: {
          trip_id?: string;
          total_paise?: number;
          category_caps?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "budgets_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          id: string;
          trip_id: string;
          payer_id: string;
          amount_paise: number;
          category: Database["public"]["Enums"]["expense_category"];
          note: string | null;
          spent_on: string;
          receipt_path: string | null;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          payer_id: string;
          amount_paise: number;
          category?: Database["public"]["Enums"]["expense_category"];
          note?: string | null;
          spent_on: string;
          receipt_path?: string | null;
          deleted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          payer_id?: string;
          amount_paise?: number;
          category?: Database["public"]["Enums"]["expense_category"];
          note?: string | null;
          spent_on?: string;
          receipt_path?: string | null;
          deleted_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_payer_id_fkey";
            columns: ["payer_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_splits: {
        Row: {
          expense_id: string;
          member_id: string;
          share_paise: number;
        };
        Insert: {
          expense_id: string;
          member_id: string;
          share_paise: number;
        };
        Update: {
          expense_id?: string;
          member_id?: string;
          share_paise?: number;
        };
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expense_splits_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      settlements: {
        Row: {
          id: string;
          trip_id: string;
          from_member: string;
          to_member: string;
          amount_paise: number;
          status: Database["public"]["Enums"]["settlement_status"];
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          from_member: string;
          to_member: string;
          amount_paise: number;
          status?: Database["public"]["Enums"]["settlement_status"];
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          from_member?: string;
          to_member?: string;
          amount_paise?: number;
          status?: Database["public"]["Enums"]["settlement_status"];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlements_from_member_fkey";
            columns: ["from_member"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlements_to_member_fkey";
            columns: ["to_member"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlements_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      photos: {
        Row: {
          id: string;
          trip_id: string;
          uploader_id: string;
          storage_path: string;
          kind: Database["public"]["Enums"]["photo_kind"];
          day_index: number | null;
          place_id: string | null;
          is_public: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          uploader_id: string;
          storage_path: string;
          kind?: Database["public"]["Enums"]["photo_kind"];
          day_index?: number | null;
          place_id?: string | null;
          is_public?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          uploader_id?: string;
          storage_path?: string;
          kind?: Database["public"]["Enums"]["photo_kind"];
          day_index?: number | null;
          place_id?: string | null;
          is_public?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "photos_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "photos_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "photos_uploader_id_fkey";
            columns: ["uploader_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      login_attempts: {
        Row: {
          id: number;
          ip: string;
          member_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: never;
          ip: string;
          member_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: never;
          ip?: string;
          member_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "login_attempts_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      document_type: "ticket" | "hotel" | "id" | "insurance" | "other";
      expense_category:
        | "food"
        | "stay"
        | "transport"
        | "activities"
        | "shopping"
        | "other";
      location_type:
        | "beach"
        | "mountain"
        | "city"
        | "forest"
        | "desert"
        | "heritage"
        | "snow"
        | "roadtrip";
      member_role: "owner" | "member";
      packing_category:
        | "clothes"
        | "gear"
        | "toiletries"
        | "docs"
        | "snacks"
        | "other";
      photo_kind: "original" | "booth";
      place_status: "proposed" | "locked";
      settlement_status: "pending" | "paid" | "confirmed";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
