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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_quote_suggestions_log: {
        Row: {
          ai_fallback_count: number | null
          catalog_match_count: number | null
          confidence: number | null
          created_at: string
          dossier_id: string
          id: string
          line_ref: string | null
          quote_id: string | null
          resolved_at: string | null
          status: string
          suggestion_payload: Json
          user_id: string
        }
        Insert: {
          ai_fallback_count?: number | null
          catalog_match_count?: number | null
          confidence?: number | null
          created_at?: string
          dossier_id: string
          id?: string
          line_ref?: string | null
          quote_id?: string | null
          resolved_at?: string | null
          status?: string
          suggestion_payload?: Json
          user_id: string
        }
        Update: {
          ai_fallback_count?: number | null
          catalog_match_count?: number | null
          confidence?: number | null
          created_at?: string
          dossier_id?: string
          id?: string
          line_ref?: string | null
          quote_id?: string | null
          resolved_at?: string | null
          status?: string
          suggestion_payload?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_quote_suggestions_log_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_quote_suggestions_log_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_summary_cache: {
        Row: {
          data_fingerprint: string
          dossier_id: string
          generated_at: string
          summary_json: Json
        }
        Insert: {
          data_fingerprint: string
          dossier_id: string
          generated_at?: string
          summary_json: Json
        }
        Update: {
          data_fingerprint?: string
          dossier_id?: string
          generated_at?: string
          summary_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_summary_cache_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_slots: {
        Row: {
          created_at: string
          dossier_id: string
          id: string
          selected_at: string | null
          slot_date: string
          time_end: string
          time_start: string
        }
        Insert: {
          created_at?: string
          dossier_id: string
          id?: string
          selected_at?: string | null
          slot_date: string
          time_end: string
          time_start: string
        }
        Update: {
          created_at?: string
          dossier_id?: string
          id?: string
          selected_at?: string | null
          slot_date?: string
          time_end?: string
          time_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_slots_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      artisan_catalog_override: {
        Row: {
          created_at: string
          custom_label: string | null
          custom_price_ht: number | null
          id: string
          is_favorite: boolean
          is_hidden: boolean
          item_id: string
          margin_percent: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_label?: string | null
          custom_price_ht?: number | null
          id?: string
          is_favorite?: boolean
          is_hidden?: boolean
          item_id: string
          margin_percent?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          custom_label?: string | null
          custom_price_ht?: number | null
          id?: string
          is_favorite?: boolean
          is_hidden?: boolean
          item_id?: string
          margin_percent?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artisan_catalog_override_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalog_material"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_template_items: {
        Row: {
          bundle_id: string
          catalog_item_id: string | null
          created_at: string
          default_qty: number
          description: string | null
          id: string
          is_optional: boolean
          item_type: string
          label: string
          sort_order: number | null
          unit: string
          unit_price: number
          vat_rate: number
        }
        Insert: {
          bundle_id: string
          catalog_item_id?: string | null
          created_at?: string
          default_qty?: number
          description?: string | null
          id?: string
          is_optional?: boolean
          item_type?: string
          label: string
          sort_order?: number | null
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          bundle_id?: string
          catalog_item_id?: string | null
          created_at?: string
          default_qty?: number
          description?: string | null
          id?: string
          is_optional?: boolean
          item_type?: string
          label?: string
          sort_order?: number | null
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundle_template_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundle_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_template_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_material"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_templates: {
        Row: {
          bundle_name: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          notes: string | null
          sort_order: number | null
          trigger_category: string
          trigger_keywords: string[] | null
          user_id: string | null
        }
        Insert: {
          bundle_name: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          sort_order?: number | null
          trigger_category: string
          trigger_keywords?: string[] | null
          user_id?: string | null
        }
        Update: {
          bundle_name?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          sort_order?: number | null
          trigger_category?: string
          trigger_keywords?: string[] | null
          user_id?: string | null
        }
        Relationships: []
      }
      catalog_import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_count: number
          dedup_strategy: string
          error_count: number
          errors: Json | null
          filename: string
          id: string
          mapping: Json | null
          skipped_count: number
          status: string
          total_rows: number
          updated_count: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_count?: number
          dedup_strategy?: string
          error_count?: number
          errors?: Json | null
          filename: string
          id?: string
          mapping?: Json | null
          skipped_count?: number
          status?: string
          total_rows?: number
          updated_count?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_count?: number
          dedup_strategy?: string
          error_count?: number
          errors?: Json | null
          filename?: string
          id?: string
          mapping?: Json | null
          skipped_count?: number
          status?: string
          total_rows?: number
          updated_count?: number
          user_id?: string
        }
        Relationships: []
      }
      catalog_material: {
        Row: {
          active: boolean
          brand: string | null
          category_id: string | null
          category_path: string
          confidence_score: number | null
          created_at: string
          default_qty: number | null
          id: string
          import_batch_id: string | null
          internal_code: string | null
          is_favorite: boolean
          label: string
          last_used_at: string | null
          last_used_price: number | null
          normalized_name: string | null
          notes: string | null
          raw_name: string | null
          secondary_sector_ids: string[]
          sector_id: string | null
          slug: string | null
          source_external_id: string | null
          source_id: string | null
          source_url: string | null
          subcategory: string | null
          supplier: string | null
          supplier_ref: string | null
          synonyms: string[] | null
          tags: string[] | null
          type: string
          unit: string | null
          unit_price: number | null
          updated_at: string
          usage_count: number
          user_id: string | null
          vat_rate: number | null
        }
        Insert: {
          active?: boolean
          brand?: string | null
          category_id?: string | null
          category_path: string
          confidence_score?: number | null
          created_at?: string
          default_qty?: number | null
          id?: string
          import_batch_id?: string | null
          internal_code?: string | null
          is_favorite?: boolean
          label: string
          last_used_at?: string | null
          last_used_price?: number | null
          normalized_name?: string | null
          notes?: string | null
          raw_name?: string | null
          secondary_sector_ids?: string[]
          sector_id?: string | null
          slug?: string | null
          source_external_id?: string | null
          source_id?: string | null
          source_url?: string | null
          subcategory?: string | null
          supplier?: string | null
          supplier_ref?: string | null
          synonyms?: string[] | null
          tags?: string[] | null
          type?: string
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
          usage_count?: number
          user_id?: string | null
          vat_rate?: number | null
        }
        Update: {
          active?: boolean
          brand?: string | null
          category_id?: string | null
          category_path?: string
          confidence_score?: number | null
          created_at?: string
          default_qty?: number | null
          id?: string
          import_batch_id?: string | null
          internal_code?: string | null
          is_favorite?: boolean
          label?: string
          last_used_at?: string | null
          last_used_price?: number | null
          normalized_name?: string | null
          notes?: string | null
          raw_name?: string | null
          secondary_sector_ids?: string[]
          sector_id?: string | null
          slug?: string | null
          source_external_id?: string | null
          source_id?: string | null
          source_url?: string | null
          subcategory?: string | null
          supplier?: string | null
          supplier_ref?: string | null
          synonyms?: string[] | null
          tags?: string[] | null
          type?: string
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
          usage_count?: number
          user_id?: string | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_material_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_material_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "product_sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_material_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_usage_log: {
        Row: {
          created_at: string
          id: string
          label: string
          material_id: string | null
          qty: number | null
          quote_id: string | null
          unit: string | null
          unit_price: number | null
          user_id: string
          vat_rate: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          material_id?: string | null
          qty?: number | null
          quote_id?: string | null
          unit?: string | null
          unit_price?: number | null
          user_id: string
          vat_rate?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          material_id?: string | null
          qty?: number | null
          quote_id?: string | null
          unit?: string | null
          unit_price?: number | null
          user_id?: string
          vat_rate?: number | null
        }
        Relationships: []
      }
      compliance_settings: {
        Row: {
          archive_locked_documents: boolean
          audit_log_enabled: boolean
          auto_add_293b_mention: boolean
          auto_add_40eur_b2b: boolean
          auto_add_decennial_notice: boolean
          auto_add_ei_mention: boolean
          auto_add_waste_mention: boolean
          block_generation_if_incomplete: boolean
          created_at: string
          default_quote_validity_days: number
          id: string
          updated_at: string
          user_id: string
          waste_management_text: string | null
        }
        Insert: {
          archive_locked_documents?: boolean
          audit_log_enabled?: boolean
          auto_add_293b_mention?: boolean
          auto_add_40eur_b2b?: boolean
          auto_add_decennial_notice?: boolean
          auto_add_ei_mention?: boolean
          auto_add_waste_mention?: boolean
          block_generation_if_incomplete?: boolean
          created_at?: string
          default_quote_validity_days?: number
          id?: string
          updated_at?: string
          user_id: string
          waste_management_text?: string | null
        }
        Update: {
          archive_locked_documents?: boolean
          audit_log_enabled?: boolean
          auto_add_293b_mention?: boolean
          auto_add_40eur_b2b?: boolean
          auto_add_decennial_notice?: boolean
          auto_add_ei_mention?: boolean
          auto_add_waste_mention?: boolean
          block_generation_if_incomplete?: boolean
          created_at?: string
          default_quote_validity_days?: number
          id?: string
          updated_at?: string
          user_id?: string
          waste_management_text?: string | null
        }
        Relationships: []
      }
      data_sources: {
        Row: {
          base_url: string | null
          config: Json | null
          created_at: string
          id: string
          last_sync_at: string | null
          name: string
          notes: string | null
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          config?: Json | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          name: string
          notes?: string | null
          source_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          config?: Json | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          name?: string
          notes?: string | null
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      dossiers: {
        Row: {
          access_code: string | null
          address: string | null
          address_line: string | null
          appointment_confirmed_at: string | null
          appointment_date: string | null
          appointment_notes: string | null
          appointment_source:
            | Database["public"]["Enums"]["appointment_source"]
            | null
          appointment_status: Database["public"]["Enums"]["appointment_status"]
          appointment_time_end: string | null
          appointment_time_start: string | null
          availability: string | null
          category: Database["public"]["Enums"]["problem_category"]
          city: string | null
          client_email: string | null
          client_first_name: string | null
          client_last_name: string | null
          client_phone: string | null
          client_token: string | null
          client_token_expires_at: string | null
          country: string | null
          created_at: string
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          floor_number: number | null
          google_calendar_event_id: string | null
          google_place_id: string | null
          has_elevator: boolean | null
          housing_type: string | null
          id: string
          last_relance_at: string | null
          lat: number | null
          lng: number | null
          occupant_type: string | null
          postal_code: string | null
          problem_types: string[] | null
          relance_active: boolean
          relance_count: number
          source: Database["public"]["Enums"]["dossier_source"]
          status: Database["public"]["Enums"]["dossier_status"]
          status_changed_at: string
          trade_types: string[] | null
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_level"]
          user_id: string
        }
        Insert: {
          access_code?: string | null
          address?: string | null
          address_line?: string | null
          appointment_confirmed_at?: string | null
          appointment_date?: string | null
          appointment_notes?: string | null
          appointment_source?:
            | Database["public"]["Enums"]["appointment_source"]
            | null
          appointment_status?: Database["public"]["Enums"]["appointment_status"]
          appointment_time_end?: string | null
          appointment_time_start?: string | null
          availability?: string | null
          category?: Database["public"]["Enums"]["problem_category"]
          city?: string | null
          client_email?: string | null
          client_first_name?: string | null
          client_last_name?: string | null
          client_phone?: string | null
          client_token?: string | null
          client_token_expires_at?: string | null
          country?: string | null
          created_at?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          floor_number?: number | null
          google_calendar_event_id?: string | null
          google_place_id?: string | null
          has_elevator?: boolean | null
          housing_type?: string | null
          id?: string
          last_relance_at?: string | null
          lat?: number | null
          lng?: number | null
          occupant_type?: string | null
          postal_code?: string | null
          problem_types?: string[] | null
          relance_active?: boolean
          relance_count?: number
          source?: Database["public"]["Enums"]["dossier_source"]
          status?: Database["public"]["Enums"]["dossier_status"]
          status_changed_at?: string
          trade_types?: string[] | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
          user_id: string
        }
        Update: {
          access_code?: string | null
          address?: string | null
          address_line?: string | null
          appointment_confirmed_at?: string | null
          appointment_date?: string | null
          appointment_notes?: string | null
          appointment_source?:
            | Database["public"]["Enums"]["appointment_source"]
            | null
          appointment_status?: Database["public"]["Enums"]["appointment_status"]
          appointment_time_end?: string | null
          appointment_time_start?: string | null
          availability?: string | null
          category?: Database["public"]["Enums"]["problem_category"]
          city?: string | null
          client_email?: string | null
          client_first_name?: string | null
          client_last_name?: string | null
          client_phone?: string | null
          client_token?: string | null
          client_token_expires_at?: string | null
          country?: string | null
          created_at?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          floor_number?: number | null
          google_calendar_event_id?: string | null
          google_place_id?: string | null
          has_elevator?: boolean | null
          housing_type?: string | null
          id?: string
          last_relance_at?: string | null
          lat?: number | null
          lng?: number | null
          occupant_type?: string | null
          postal_code?: string | null
          problem_types?: string[] | null
          relance_active?: boolean
          relance_count?: number
          source?: Database["public"]["Enums"]["dossier_source"]
          status?: Database["public"]["Enums"]["dossier_status"]
          status_changed_at?: string
          trade_types?: string[] | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
          user_id?: string
        }
        Relationships: []
      }
      email_log: {
        Row: {
          created_at: string
          document_id: string | null
          document_type: string | null
          dossier_id: string | null
          error: string | null
          id: string
          provider: string | null
          recipient: string | null
          status: string
          template: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          document_type?: string | null
          dossier_id?: string | null
          error?: string | null
          id?: string
          provider?: string | null
          recipient?: string | null
          status?: string
          template: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          document_type?: string | null
          dossier_id?: string | null
          error?: string | null
          id?: string
          provider?: string | null
          recipient?: string | null
          status?: string
          template?: string
          user_id?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          created_at: string
          error_message: string
          error_stack: string | null
          function_name: string | null
          id: string
          metadata: Json | null
          resolved: boolean
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message: string
          error_stack?: string | null
          function_name?: string | null
          id?: string
          metadata?: Json | null
          resolved?: boolean
          source?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string
          error_stack?: string | null
          function_name?: string | null
          id?: string
          metadata?: Json | null
          resolved?: boolean
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      gmail_connections: {
        Row: {
          access_token: string
          created_at: string
          gmail_address: string
          id: string
          refresh_token: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          gmail_address: string
          id?: string
          refresh_token: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          gmail_address?: string
          id?: string
          refresh_token?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_connections: {
        Row: {
          access_token: string
          created_at: string
          google_email: string
          id: string
          refresh_token: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          google_email: string
          id?: string
          refresh_token: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          google_email?: string
          id?: string
          refresh_token?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      historique: {
        Row: {
          action: string
          created_at: string
          details: string | null
          dossier_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          dossier_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          dossier_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historique_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_jobs: {
        Row: {
          created_at: string
          data_source_id: string | null
          errors_json: Json | null
          finished_at: string | null
          id: string
          items_created: number | null
          items_flagged: number | null
          items_found: number | null
          items_updated: number | null
          started_at: string | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          data_source_id?: string | null
          errors_json?: Json | null
          finished_at?: string | null
          id?: string
          items_created?: number | null
          items_flagged?: number | null
          items_found?: number | null
          items_updated?: number | null
          started_at?: string | null
          status?: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          data_source_id?: string | null
          errors_json?: Json | null
          finished_at?: string | null
          id?: string
          items_created?: number | null
          items_flagged?: number | null
          items_found?: number | null
          items_updated?: number | null
          started_at?: string | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_profiles: {
        Row: {
          created_at: string
          decennial_required: boolean
          default_legal_text: string | null
          geographic_coverage: string | null
          id: string
          insurer_contact: string | null
          insurer_name: string | null
          policy_number: string | null
          updated_at: string
          user_id: string
          validity_end: string | null
          validity_start: string | null
        }
        Insert: {
          created_at?: string
          decennial_required?: boolean
          default_legal_text?: string | null
          geographic_coverage?: string | null
          id?: string
          insurer_contact?: string | null
          insurer_name?: string | null
          policy_number?: string | null
          updated_at?: string
          user_id: string
          validity_end?: string | null
          validity_start?: string | null
        }
        Update: {
          created_at?: string
          decennial_required?: boolean
          default_legal_text?: string | null
          geographic_coverage?: string | null
          id?: string
          insurer_contact?: string | null
          insurer_name?: string | null
          policy_number?: string | null
          updated_at?: string
          user_id?: string
          validity_end?: string | null
          validity_start?: string | null
        }
        Relationships: []
      }
      intervention_product_packs: {
        Row: {
          id: string
          intervention_type_id: string
          labor_lines: Json
          often_added_products: Json
          optional_products: Json
          qualification_questions: Json
          required_products: Json
          travel_lines: Json
          updated_at: string
          waste_lines: Json
        }
        Insert: {
          id?: string
          intervention_type_id: string
          labor_lines?: Json
          often_added_products?: Json
          optional_products?: Json
          qualification_questions?: Json
          required_products?: Json
          travel_lines?: Json
          updated_at?: string
          waste_lines?: Json
        }
        Update: {
          id?: string
          intervention_type_id?: string
          labor_lines?: Json
          often_added_products?: Json
          optional_products?: Json
          qualification_questions?: Json
          required_products?: Json
          travel_lines?: Json
          updated_at?: string
          waste_lines?: Json
        }
        Relationships: [
          {
            foreignKeyName: "intervention_product_packs_intervention_type_id_fkey"
            columns: ["intervention_type_id"]
            isOneToOne: false
            referencedRelation: "intervention_types"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          sector_id: string | null
          slug: string
          sort_order: number | null
          synonyms: string[] | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sector_id?: string | null
          slug: string
          sort_order?: number | null
          synonyms?: string[] | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sector_id?: string | null
          slug?: string
          sort_order?: number | null
          synonyms?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_types_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "product_sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          created_at: string
          description: string | null
          discount: number
          discount_unit: string
          id: string
          invoice_id: string
          label: string
          qty: number
          sort_order: number
          tva_rate: number
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount?: number
          discount_unit?: string
          id?: string
          invoice_id: string
          label: string
          qty?: number
          sort_order?: number
          tva_rate?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount?: number
          discount_unit?: string
          id?: string
          invoice_id?: string
          label?: string
          qty?: number
          sort_order?: number
          tva_rate?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number | null
          artisan_address: string | null
          artisan_company: string | null
          artisan_email: string | null
          artisan_name: string | null
          artisan_phone: string | null
          artisan_siret: string | null
          artisan_tva_intracom: string | null
          cancel_reason: string | null
          canceled_at: string | null
          client_address: string | null
          client_company: string | null
          client_email: string | null
          client_first_name: string | null
          client_last_name: string | null
          client_phone: string | null
          client_token: string | null
          client_token_expires_at: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          compliance_snapshot: Json | null
          created_at: string
          customer_siren: string | null
          delivery_address: string | null
          dossier_id: string
          due_date: string | null
          id: string
          invoice_number: string
          invoice_type: Database["public"]["Enums"]["invoice_doc_type"]
          issue_date: string
          late_fees_text: string | null
          late_penalty_rate: number | null
          legal_mentions_snapshot: Json | null
          notes: string | null
          operation_category:
            | Database["public"]["Enums"]["operation_category"]
            | null
          paid_at: string | null
          parent_invoice_id: string | null
          payment_terms: string | null
          pdf_url: string | null
          recovery_fee_applied: boolean | null
          related_quote_id: string | null
          sent_at: string | null
          service_date: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          total_ht: number | null
          total_ttc: number | null
          total_tva: number | null
          updated_at: string
          user_id: string
          vat_mode: Database["public"]["Enums"]["vat_mode"]
          version_number: number
          worksite_address: string | null
        }
        Insert: {
          amount_paid?: number | null
          artisan_address?: string | null
          artisan_company?: string | null
          artisan_email?: string | null
          artisan_name?: string | null
          artisan_phone?: string | null
          artisan_siret?: string | null
          artisan_tva_intracom?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          client_address?: string | null
          client_company?: string | null
          client_email?: string | null
          client_first_name?: string | null
          client_last_name?: string | null
          client_phone?: string | null
          client_token?: string | null
          client_token_expires_at?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          compliance_snapshot?: Json | null
          created_at?: string
          customer_siren?: string | null
          delivery_address?: string | null
          dossier_id: string
          due_date?: string | null
          id?: string
          invoice_number: string
          invoice_type?: Database["public"]["Enums"]["invoice_doc_type"]
          issue_date?: string
          late_fees_text?: string | null
          late_penalty_rate?: number | null
          legal_mentions_snapshot?: Json | null
          notes?: string | null
          operation_category?:
            | Database["public"]["Enums"]["operation_category"]
            | null
          paid_at?: string | null
          parent_invoice_id?: string | null
          payment_terms?: string | null
          pdf_url?: string | null
          recovery_fee_applied?: boolean | null
          related_quote_id?: string | null
          sent_at?: string | null
          service_date?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_ht?: number | null
          total_ttc?: number | null
          total_tva?: number | null
          updated_at?: string
          user_id: string
          vat_mode?: Database["public"]["Enums"]["vat_mode"]
          version_number?: number
          worksite_address?: string | null
        }
        Update: {
          amount_paid?: number | null
          artisan_address?: string | null
          artisan_company?: string | null
          artisan_email?: string | null
          artisan_name?: string | null
          artisan_phone?: string | null
          artisan_siret?: string | null
          artisan_tva_intracom?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          client_address?: string | null
          client_company?: string | null
          client_email?: string | null
          client_first_name?: string | null
          client_last_name?: string | null
          client_phone?: string | null
          client_token?: string | null
          client_token_expires_at?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          compliance_snapshot?: Json | null
          created_at?: string
          customer_siren?: string | null
          delivery_address?: string | null
          dossier_id?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          invoice_type?: Database["public"]["Enums"]["invoice_doc_type"]
          issue_date?: string
          late_fees_text?: string | null
          late_penalty_rate?: number | null
          legal_mentions_snapshot?: Json | null
          notes?: string | null
          operation_category?:
            | Database["public"]["Enums"]["operation_category"]
            | null
          paid_at?: string | null
          parent_invoice_id?: string | null
          payment_terms?: string | null
          pdf_url?: string | null
          recovery_fee_applied?: boolean | null
          related_quote_id?: string | null
          sent_at?: string | null
          service_date?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_ht?: number | null
          total_ttc?: number | null
          total_tva?: number | null
          updated_at?: string
          user_id?: string
          vat_mode?: Database["public"]["Enums"]["vat_mode"]
          version_number?: number
          worksite_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      labour_templates: {
        Row: {
          context_tags: string[] | null
          created_at: string
          duration_default_min: number | null
          id: string
          text_reassuring: string
          text_short: string
          text_standard: string
        }
        Insert: {
          context_tags?: string[] | null
          created_at?: string
          duration_default_min?: number | null
          id?: string
          text_reassuring: string
          text_short: string
          text_standard: string
        }
        Update: {
          context_tags?: string[] | null
          created_at?: string
          duration_default_min?: number | null
          id?: string
          text_reassuring?: string
          text_short?: string
          text_standard?: string
        }
        Relationships: []
      }
      material_correspondence: {
        Row: {
          conditions_json: Json | null
          created_at: string
          default_qty: number | null
          group_label: string | null
          id: string
          source_material_id: string
          target_material_id: string
          weight: number | null
        }
        Insert: {
          conditions_json?: Json | null
          created_at?: string
          default_qty?: number | null
          group_label?: string | null
          id?: string
          source_material_id: string
          target_material_id: string
          weight?: number | null
        }
        Update: {
          conditions_json?: Json | null
          created_at?: string
          default_qty?: number | null
          group_label?: string | null
          id?: string
          source_material_id?: string
          target_material_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_correspondence_source_material_id_fkey"
            columns: ["source_material_id"]
            isOneToOne: false
            referencedRelation: "catalog_material"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_correspondence_target_material_id_fkey"
            columns: ["target_material_id"]
            isOneToOne: false
            referencedRelation: "catalog_material"
            referencedColumns: ["id"]
          },
        ]
      }
      medias: {
        Row: {
          created_at: string
          dossier_id: string
          duration: number | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          media_category: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dossier_id: string
          duration?: number | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          media_category?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dossier_id?: string
          duration?: number | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          media_category?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medias_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          channel: string
          created_at: string
          dossier_id: string
          error_code: string | null
          error_message: string | null
          event_type: string
          id: string
          recipient: string
          sent_at: string | null
          status: string
        }
        Insert: {
          channel: string
          created_at?: string
          dossier_id: string
          error_code?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          recipient: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          channel?: string
          created_at?: string
          dossier_id?: string
          error_code?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          recipient?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_taxonomy: {
        Row: {
          created_at: string
          default_context: Json | null
          id: string
          keywords: string[] | null
          label: string
          parent_id: string | null
          sort_order: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          default_context?: Json | null
          id?: string
          keywords?: string[] | null
          label: string
          parent_id?: string | null
          sort_order?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          default_context?: Json | null
          id?: string
          keywords?: string[] | null
          label?: string
          parent_id?: string | null
          sort_order?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "problem_taxonomy_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "problem_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_to_manoeuvre: {
        Row: {
          conditions_json: Json | null
          created_at: string
          default_qty: number | null
          description: string | null
          id: string
          label: string
          problem_id: string
          type: string | null
          unit: string | null
          unit_price: number | null
          vat_rate: number | null
          weight: number | null
        }
        Insert: {
          conditions_json?: Json | null
          created_at?: string
          default_qty?: number | null
          description?: string | null
          id?: string
          label: string
          problem_id: string
          type?: string | null
          unit?: string | null
          unit_price?: number | null
          vat_rate?: number | null
          weight?: number | null
        }
        Update: {
          conditions_json?: Json | null
          created_at?: string
          default_qty?: number | null
          description?: string | null
          id?: string
          label?: string
          problem_id?: string
          type?: string | null
          unit?: string | null
          unit_price?: number | null
          vat_rate?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "problem_to_manoeuvre_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problem_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      product_associations: {
        Row: {
          created_at: string
          id: string
          intervention_type_id: string | null
          parent_product_id: string
          related_product_id: string
          relation_type: string
          relevance_score: number
        }
        Insert: {
          created_at?: string
          id?: string
          intervention_type_id?: string | null
          parent_product_id: string
          related_product_id: string
          relation_type: string
          relevance_score?: number
        }
        Update: {
          created_at?: string
          id?: string
          intervention_type_id?: string | null
          parent_product_id?: string
          related_product_id?: string
          relation_type?: string
          relevance_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_associations_intervention_type_id_fkey"
            columns: ["intervention_type_id"]
            isOneToOne: false
            referencedRelation: "intervention_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_associations_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_material"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_associations_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_material"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          level: number
          name: string
          parent_id: string | null
          sector_id: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          level?: number
          name: string
          parent_id?: string | null
          sector_id: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          name?: string
          parent_id?: string | null
          sector_id?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "product_sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      product_classification_audit: {
        Row: {
          applied_at: string | null
          confidence: number | null
          created_at: string
          id: string
          material_id: string
          old_category_id: string | null
          old_category_path: string | null
          old_sector_id: string | null
          reasoning: string | null
          review_status: string
          suggested_category_id: string | null
          suggested_primary_sector_id: string | null
          suggested_secondary_sector_ids: string[] | null
          suggested_subcategory: string | null
          suggested_synonyms: string[] | null
          suggested_tags: string[] | null
        }
        Insert: {
          applied_at?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          material_id: string
          old_category_id?: string | null
          old_category_path?: string | null
          old_sector_id?: string | null
          reasoning?: string | null
          review_status?: string
          suggested_category_id?: string | null
          suggested_primary_sector_id?: string | null
          suggested_secondary_sector_ids?: string[] | null
          suggested_subcategory?: string | null
          suggested_synonyms?: string[] | null
          suggested_tags?: string[] | null
        }
        Update: {
          applied_at?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          material_id?: string
          old_category_id?: string | null
          old_category_path?: string | null
          old_sector_id?: string | null
          reasoning?: string | null
          review_status?: string
          suggested_category_id?: string | null
          suggested_primary_sector_id?: string | null
          suggested_secondary_sector_ids?: string[] | null
          suggested_subcategory?: string | null
          suggested_synonyms?: string[] | null
          suggested_tags?: string[] | null
        }
        Relationships: []
      }
      product_sectors: {
        Row: {
          active: boolean
          created_at: string
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accepted_payment_methods: string[] | null
          address: string | null
          auto_relance_enabled: boolean
          auto_send_client_link: boolean
          bic: string | null
          capital_amount: number | null
          client_link_validity_days: number
          client_message_template: string | null
          client_slots_enabled: boolean
          company_name: string | null
          compliance_score: number | null
          created_at: string
          default_deposit_type: string | null
          default_deposit_value: number | null
          default_validity_days: number | null
          default_vat_rate: number | null
          early_payment_discount_text: string | null
          email: string | null
          email_signature: string | null
          favorite_vat_rates: number[] | null
          first_name: string | null
          fixed_recovery_fee_b2b: boolean
          footer_text: string | null
          iban: string | null
          id: string
          last_name: string | null
          late_penalty_rate: number | null
          legal_form: Database["public"]["Enums"]["legal_form"] | null
          logo_url: string | null
          onboarding_compliance_completed_at: string | null
          owner_first_name: string | null
          owner_last_name: string | null
          payment_terms_default: string | null
          phone: string | null
          primary_color: string | null
          public_client_slug: string | null
          rcs_city: string | null
          relance_delay_devis_1: number
          relance_delay_devis_2: number
          relance_delay_facture_1: number
          relance_delay_facture_2: number
          relance_delay_info: number
          siren: string | null
          siret: string | null
          sms_enabled: boolean
          trade_name: string | null
          tva_intracom: string | null
          updated_at: string
          user_id: string
          vat_applicable: boolean
          vat_exemption_293b: boolean
          vat_on_debits: boolean
        }
        Insert: {
          accepted_payment_methods?: string[] | null
          address?: string | null
          auto_relance_enabled?: boolean
          auto_send_client_link?: boolean
          bic?: string | null
          capital_amount?: number | null
          client_link_validity_days?: number
          client_message_template?: string | null
          client_slots_enabled?: boolean
          company_name?: string | null
          compliance_score?: number | null
          created_at?: string
          default_deposit_type?: string | null
          default_deposit_value?: number | null
          default_validity_days?: number | null
          default_vat_rate?: number | null
          early_payment_discount_text?: string | null
          email?: string | null
          email_signature?: string | null
          favorite_vat_rates?: number[] | null
          first_name?: string | null
          fixed_recovery_fee_b2b?: boolean
          footer_text?: string | null
          iban?: string | null
          id?: string
          last_name?: string | null
          late_penalty_rate?: number | null
          legal_form?: Database["public"]["Enums"]["legal_form"] | null
          logo_url?: string | null
          onboarding_compliance_completed_at?: string | null
          owner_first_name?: string | null
          owner_last_name?: string | null
          payment_terms_default?: string | null
          phone?: string | null
          primary_color?: string | null
          public_client_slug?: string | null
          rcs_city?: string | null
          relance_delay_devis_1?: number
          relance_delay_devis_2?: number
          relance_delay_facture_1?: number
          relance_delay_facture_2?: number
          relance_delay_info?: number
          siren?: string | null
          siret?: string | null
          sms_enabled?: boolean
          trade_name?: string | null
          tva_intracom?: string | null
          updated_at?: string
          user_id: string
          vat_applicable?: boolean
          vat_exemption_293b?: boolean
          vat_on_debits?: boolean
        }
        Update: {
          accepted_payment_methods?: string[] | null
          address?: string | null
          auto_relance_enabled?: boolean
          auto_send_client_link?: boolean
          bic?: string | null
          capital_amount?: number | null
          client_link_validity_days?: number
          client_message_template?: string | null
          client_slots_enabled?: boolean
          company_name?: string | null
          compliance_score?: number | null
          created_at?: string
          default_deposit_type?: string | null
          default_deposit_value?: number | null
          default_validity_days?: number | null
          default_vat_rate?: number | null
          early_payment_discount_text?: string | null
          email?: string | null
          email_signature?: string | null
          favorite_vat_rates?: number[] | null
          first_name?: string | null
          fixed_recovery_fee_b2b?: boolean
          footer_text?: string | null
          iban?: string | null
          id?: string
          last_name?: string | null
          late_penalty_rate?: number | null
          legal_form?: Database["public"]["Enums"]["legal_form"] | null
          logo_url?: string | null
          onboarding_compliance_completed_at?: string | null
          owner_first_name?: string | null
          owner_last_name?: string | null
          payment_terms_default?: string | null
          phone?: string | null
          primary_color?: string | null
          public_client_slug?: string | null
          rcs_city?: string | null
          relance_delay_devis_1?: number
          relance_delay_devis_2?: number
          relance_delay_facture_1?: number
          relance_delay_facture_2?: number
          relance_delay_info?: number
          siren?: string | null
          siret?: string | null
          sms_enabled?: boolean
          trade_name?: string | null
          tva_intracom?: string | null
          updated_at?: string
          user_id?: string
          vat_applicable?: boolean
          vat_exemption_293b?: boolean
          vat_on_debits?: boolean
        }
        Relationships: []
      }
      quote_context: {
        Row: {
          access: string | null
          evacuation_type: string | null
          include_tests: boolean | null
          include_travel: boolean | null
          network_type: string | null
          quote_id: string
          updated_at: string
          urgency: boolean | null
          wc_type: string | null
        }
        Insert: {
          access?: string | null
          evacuation_type?: string | null
          include_tests?: boolean | null
          include_travel?: boolean | null
          network_type?: string | null
          quote_id: string
          updated_at?: string
          urgency?: boolean | null
          wc_type?: string | null
        }
        Update: {
          access?: string | null
          evacuation_type?: string | null
          include_tests?: boolean | null
          include_travel?: boolean | null
          network_type?: string | null
          quote_id?: string
          updated_at?: string
          urgency?: boolean | null
          wc_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_context_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_labour_summary: {
        Row: {
          is_locked: boolean
          quote_id: string
          summary_text: string
          updated_at: string
          variant: string
        }
        Insert: {
          is_locked?: boolean
          quote_id: string
          summary_text?: string
          updated_at?: string
          variant?: string
        }
        Update: {
          is_locked?: boolean
          quote_id?: string
          summary_text?: string
          updated_at?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_labour_summary_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_lines: {
        Row: {
          created_at: string
          description: string | null
          discount: number
          id: string
          label: string
          line_type: string
          qty: number
          quote_id: string
          sort_order: number
          source: string
          source_ref_id: string | null
          tva_rate: number
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount?: number
          id?: string
          label: string
          line_type?: string
          qty?: number
          quote_id: string
          sort_order?: number
          source?: string
          source_ref_id?: string | null
          tva_rate?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount?: number
          id?: string
          label?: string
          line_type?: string
          qty?: number
          quote_id?: string
          sort_order?: number
          source?: string
          source_ref_id?: string | null
          tva_rate?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          accepted_ip: string | null
          accepted_user_agent: string | null
          cancel_reason: string | null
          canceled_at: string | null
          compliance_snapshot: Json | null
          created_at: string
          deposit_type: string | null
          deposit_value: number | null
          dossier_id: string
          id: string
          is_imported: boolean
          items: Json | null
          legal_mentions_snapshot: Json | null
          notes: string | null
          parent_quote_id: string | null
          pdf_url: string | null
          quote_number: string
          refused_at: string | null
          refused_reason: string | null
          sent_at: string | null
          signature_token: string | null
          signature_token_expires_at: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["quote_status"]
          total_ht: number | null
          total_ttc: number | null
          total_tva: number | null
          updated_at: string
          user_id: string
          validity_days: number | null
          version_number: number
        }
        Insert: {
          accepted_at?: string | null
          accepted_ip?: string | null
          accepted_user_agent?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          compliance_snapshot?: Json | null
          created_at?: string
          deposit_type?: string | null
          deposit_value?: number | null
          dossier_id: string
          id?: string
          is_imported?: boolean
          items?: Json | null
          legal_mentions_snapshot?: Json | null
          notes?: string | null
          parent_quote_id?: string | null
          pdf_url?: string | null
          quote_number: string
          refused_at?: string | null
          refused_reason?: string | null
          sent_at?: string | null
          signature_token?: string | null
          signature_token_expires_at?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          total_ht?: number | null
          total_ttc?: number | null
          total_tva?: number | null
          updated_at?: string
          user_id: string
          validity_days?: number | null
          version_number?: number
        }
        Update: {
          accepted_at?: string | null
          accepted_ip?: string | null
          accepted_user_agent?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          compliance_snapshot?: Json | null
          created_at?: string
          deposit_type?: string | null
          deposit_value?: number | null
          dossier_id?: string
          id?: string
          is_imported?: boolean
          items?: Json | null
          legal_mentions_snapshot?: Json | null
          notes?: string | null
          parent_quote_id?: string | null
          pdf_url?: string | null
          quote_number?: string
          refused_at?: string | null
          refused_reason?: string | null
          sent_at?: string | null
          signature_token?: string | null
          signature_token_expires_at?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          total_ht?: number | null
          total_ttc?: number | null
          total_tva?: number | null
          updated_at?: string
          user_id?: string
          validity_days?: number | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      relances: {
        Row: {
          dossier_id: string
          email_to: string
          id: string
          sent_at: string
          status: string
          type: string
          user_id: string
        }
        Insert: {
          dossier_id: string
          email_to: string
          id?: string
          sent_at?: string
          status?: string
          type: string
          user_id: string
        }
        Update: {
          dossier_id?: string
          email_to?: string
          id?: string
          sent_at?: string
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relances_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_intervention_kits: {
        Row: {
          created_at: string
          id: string
          intervention_type_id: string | null
          is_default: boolean
          items: Json
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intervention_type_id?: string | null
          is_default?: boolean
          items?: Json
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intervention_type_id?: string | null
          is_default?: boolean
          items?: Json
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_intervention_kits_intervention_type_id_fkey"
            columns: ["intervention_type_id"]
            isOneToOne: false
            referencedRelation: "intervention_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_product_usage: {
        Row: {
          behavior_type: string
          created_at: string
          id: string
          intervention_type_id: string | null
          metadata: Json | null
          product_id: string | null
          user_id: string
        }
        Insert: {
          behavior_type: string
          created_at?: string
          id?: string
          intervention_type_id?: string | null
          metadata?: Json | null
          product_id?: string | null
          user_id: string
        }
        Update: {
          behavior_type?: string
          created_at?: string
          id?: string
          intervention_type_id?: string | null
          metadata?: Json | null
          product_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_product_usage_intervention_type_id_fkey"
            columns: ["intervention_type_id"]
            isOneToOne: false
            referencedRelation: "intervention_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_product_usage_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_material"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_suggestion_preference: {
        Row: {
          created_at: string
          id: string
          intervention_id: string | null
          is_hidden: boolean
          item_signature: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intervention_id?: string | null
          is_hidden?: boolean
          item_signature: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intervention_id?: string | null
          is_hidden?: boolean
          item_signature?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_suggestion_preference_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "problem_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_credit_note_number: {
        Args: { p_user_id: string }
        Returns: string
      }
      generate_deposit_invoice_number: {
        Args: { p_user_id: string }
        Returns: string
      }
      generate_invoice_number: {
        Args: { p_client_name?: string; p_user_id: string }
        Returns: string
      }
      generate_quote_number: {
        Args: { p_client_name?: string; p_user_id: string }
        Returns: string
      }
      get_public_profile_by_slug: {
        Args: { _slug: string }
        Returns: {
          client_message_template: string
          client_slots_enabled: boolean
          company_name: string
          first_name: string
          last_name: string
          logo_url: string
          primary_color: string
          public_client_slug: string
          trade_name: string
          user_id: string
        }[]
      }
      get_public_profile_for_invoice: {
        Args: { _client_token: string }
        Returns: {
          address: string
          company_name: string
          email: string
          email_signature: string
          first_name: string
          footer_text: string
          last_name: string
          legal_form: string
          logo_url: string
          phone: string
          primary_color: string
          siret: string
          trade_name: string
          user_id: string
        }[]
      }
      get_public_profile_for_quote: {
        Args: { _signature_token: string }
        Returns: {
          address: string
          company_name: string
          email: string
          email_signature: string
          first_name: string
          footer_text: string
          last_name: string
          legal_form: string
          logo_url: string
          phone: string
          primary_color: string
          siret: string
          trade_name: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "artisan"
      appointment_source: "client_selected" | "manual" | "phone" | "email"
      appointment_status:
        | "none"
        | "rdv_pending"
        | "slots_proposed"
        | "client_selected"
        | "rdv_confirmed"
        | "cancelled"
        | "done"
      client_type: "individual" | "business"
      dossier_source: "lien_client" | "manuel" | "email" | "public_link"
      dossier_status:
        | "nouveau"
        | "a_qualifier"
        | "devis_a_faire"
        | "devis_envoye"
        | "clos_signe"
        | "clos_perdu"
        | "invoice_pending"
        | "invoice_paid"
        | "devis_signe"
        | "en_attente_rdv"
        | "rdv_pris"
        | "rdv_termine"
      invoice_doc_type: "standalone" | "final" | "deposit" | "credit_note"
      invoice_status: "draft" | "sent" | "paid" | "canceled"
      legal_form: "ei" | "micro" | "eurl" | "sarl" | "sasu" | "sas" | "autre"
      operation_category: "sale" | "service" | "mixed"
      problem_category:
        | "wc"
        | "fuite"
        | "chauffe_eau"
        | "evier"
        | "douche"
        | "autre"
      quote_status:
        | "brouillon"
        | "envoye"
        | "signe"
        | "refuse"
        | "annule"
        | "expire"
      urgency_level: "aujourdhui" | "48h" | "semaine"
      vat_mode: "normal" | "no_vat_293b"
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
      app_role: ["admin", "artisan"],
      appointment_source: ["client_selected", "manual", "phone", "email"],
      appointment_status: [
        "none",
        "rdv_pending",
        "slots_proposed",
        "client_selected",
        "rdv_confirmed",
        "cancelled",
        "done",
      ],
      client_type: ["individual", "business"],
      dossier_source: ["lien_client", "manuel", "email", "public_link"],
      dossier_status: [
        "nouveau",
        "a_qualifier",
        "devis_a_faire",
        "devis_envoye",
        "clos_signe",
        "clos_perdu",
        "invoice_pending",
        "invoice_paid",
        "devis_signe",
        "en_attente_rdv",
        "rdv_pris",
        "rdv_termine",
      ],
      invoice_doc_type: ["standalone", "final", "deposit", "credit_note"],
      invoice_status: ["draft", "sent", "paid", "canceled"],
      legal_form: ["ei", "micro", "eurl", "sarl", "sasu", "sas", "autre"],
      operation_category: ["sale", "service", "mixed"],
      problem_category: [
        "wc",
        "fuite",
        "chauffe_eau",
        "evier",
        "douche",
        "autre",
      ],
      quote_status: [
        "brouillon",
        "envoye",
        "signe",
        "refuse",
        "annule",
        "expire",
      ],
      urgency_level: ["aujourdhui", "48h", "semaine"],
      vat_mode: ["normal", "no_vat_293b"],
    },
  },
} as const
