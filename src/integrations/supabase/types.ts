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
      activity_types: {
        Row: {
          aktif: boolean
          created_at: string
          id: string
          keterangan: string | null
          nama: string
          updated_at: string
        }
        Insert: {
          aktif?: boolean
          created_at?: string
          id?: string
          keterangan?: string | null
          nama: string
          updated_at?: string
        }
        Update: {
          aktif?: boolean
          created_at?: string
          id?: string
          keterangan?: string | null
          nama?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_extractions: {
        Row: {
          confidence: number | null
          created_at: string
          created_by: string | null
          fields_needing_confirmation: string[]
          hasil: Json
          id: string
          input_teks: string | null
          report_id: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          fields_needing_confirmation?: string[]
          hasil: Json
          id?: string
          input_teks?: string | null
          report_id?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          fields_needing_confirmation?: string[]
          hasil?: Json
          id?: string
          input_teks?: string | null
          report_id?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_extractions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_extractions_whatsapp_message_id_fkey"
            columns: ["whatsapp_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          actor_id: string | null
          aksi: string
          alasan: string | null
          created_at: string
          data_sebelum: Json | null
          data_sesudah: Json | null
          id: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          actor_id?: string | null
          aksi: string
          alasan?: string | null
          created_at?: string
          data_sebelum?: Json | null
          data_sesudah?: Json | null
          id?: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          actor_id?: string | null
          aksi?: string
          alasan?: string | null
          created_at?: string
          data_sebelum?: Json | null
          data_sesudah?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          aktif: boolean
          catatan: string | null
          created_at: string
          id: string
          kategori: string | null
          nama: string
          updated_at: string
        }
        Insert: {
          aktif?: boolean
          catatan?: string | null
          created_at?: string
          id?: string
          kategori?: string | null
          nama: string
          updated_at?: string
        }
        Update: {
          aktif?: boolean
          catatan?: string | null
          created_at?: string
          id?: string
          kategori?: string | null
          nama?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          dibaca: boolean
          id: string
          judul: string
          pesan: string | null
          report_id: string | null
          tipe: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dibaca?: boolean
          id?: string
          judul: string
          pesan?: string | null
          report_id?: string | null
          tipe?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dibaca?: boolean
          id?: string
          judul?: string
          pesan?: string | null
          report_id?: string | null
          tipe?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nama_lengkap: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nama_lengkap?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nama_lengkap?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_photos: {
        Row: {
          id: string
          nama_file: string | null
          report_id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          id?: string
          nama_file?: string | null
          report_id: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          id?: string
          nama_file?: string | null
          report_id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_photos_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_verifications: {
        Row: {
          catatan: string | null
          created_at: string
          hasil: Database["public"]["Enums"]["report_status"]
          id: string
          report_id: string
          verifier_id: string | null
        }
        Insert: {
          catatan?: string | null
          created_at?: string
          hasil: Database["public"]["Enums"]["report_status"]
          id?: string
          report_id: string
          verifier_id?: string | null
        }
        Update: {
          catatan?: string | null
          created_at?: string
          hasil?: Database["public"]["Enums"]["report_status"]
          id?: string
          report_id?: string
          verifier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_verifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          catatan_revisi: string | null
          created_at: string
          created_by: string | null
          id: string
          jam_mulai: string | null
          jam_perlu_konfirmasi: boolean
          jam_selesai: string | null
          jenis_kegiatan: string | null
          jumlah_hadir: number
          jumlah_peserta: number
          jumlah_tambahan: number
          jumlah_tidak_hadir: number
          kelas: string | null
          keterangan: string | null
          lokasi: string | null
          materi: string
          material_id: string | null
          penanggung_jawab: string | null
          schedule_id: string | null
          status_laporan: Database["public"]["Enums"]["report_status"]
          sumber_laporan: Database["public"]["Enums"]["report_source"]
          tanggal_kegiatan: string
          tanggal_selesai: string | null
          trainer_id: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          waktu_laporan_dikirim: string | null
        }
        Insert: {
          catatan_revisi?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          jam_mulai?: string | null
          jam_perlu_konfirmasi?: boolean
          jam_selesai?: string | null
          jenis_kegiatan?: string | null
          jumlah_hadir?: number
          jumlah_peserta?: number
          jumlah_tambahan?: number
          jumlah_tidak_hadir?: number
          kelas?: string | null
          keterangan?: string | null
          lokasi?: string | null
          materi: string
          material_id?: string | null
          penanggung_jawab?: string | null
          schedule_id?: string | null
          status_laporan?: Database["public"]["Enums"]["report_status"]
          sumber_laporan?: Database["public"]["Enums"]["report_source"]
          tanggal_kegiatan: string
          tanggal_selesai?: string | null
          trainer_id: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          waktu_laporan_dikirim?: string | null
        }
        Update: {
          catatan_revisi?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          jam_mulai?: string | null
          jam_perlu_konfirmasi?: boolean
          jam_selesai?: string | null
          jenis_kegiatan?: string | null
          jumlah_hadir?: number
          jumlah_peserta?: number
          jumlah_tambahan?: number
          jumlah_tidak_hadir?: number
          kelas?: string | null
          keterangan?: string | null
          lokasi?: string | null
          materi?: string
          material_id?: string | null
          penanggung_jawab?: string | null
          schedule_id?: string | null
          status_laporan?: Database["public"]["Enums"]["report_status"]
          sumber_laporan?: Database["public"]["Enums"]["report_source"]
          tanggal_kegiatan?: string
          tanggal_selesai?: string | null
          trainer_id?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          waktu_laporan_dikirim?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          aktif: boolean
          catatan: string | null
          created_at: string
          id: string
          jam_mulai: string | null
          jam_selesai: string | null
          kategori: string | null
          kelas: string | null
          materi_lanjutan_dari: string | null
          material_id: string | null
          nama_kegiatan: string
          training_day_id: string | null
          updated_at: string
          urutan: number
        }
        Insert: {
          aktif?: boolean
          catatan?: string | null
          created_at?: string
          id?: string
          jam_mulai?: string | null
          jam_selesai?: string | null
          kategori?: string | null
          kelas?: string | null
          materi_lanjutan_dari?: string | null
          material_id?: string | null
          nama_kegiatan: string
          training_day_id?: string | null
          updated_at?: string
          urutan?: number
        }
        Update: {
          aktif?: boolean
          catatan?: string | null
          created_at?: string
          id?: string
          jam_mulai?: string | null
          jam_selesai?: string | null
          kategori?: string | null
          kelas?: string | null
          materi_lanjutan_dari?: string | null
          material_id?: string | null
          nama_kegiatan?: string
          training_day_id?: string | null
          updated_at?: string
          urutan?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedules_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_training_day_id_fkey"
            columns: ["training_day_id"]
            isOneToOne: false
            referencedRelation: "training_days"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          keterangan: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          keterangan?: string | null
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          keterangan?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      trainers: {
        Row: {
          aktif: boolean
          akun_aktif: boolean
          created_at: string
          departemen: string
          email: string | null
          foto_profil: string | null
          foto_url: string | null
          id: string
          jabatan: string
          nama_lengkap: string
          nomor_id_trainer: string
          nomor_whatsapp: string | null
          role: Database["public"]["Enums"]["app_role"]
          status_trainer: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          aktif?: boolean
          akun_aktif?: boolean
          created_at?: string
          departemen?: string
          email?: string | null
          foto_profil?: string | null
          foto_url?: string | null
          id?: string
          jabatan?: string
          nama_lengkap: string
          nomor_id_trainer: string
          nomor_whatsapp?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status_trainer?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          aktif?: boolean
          akun_aktif?: boolean
          created_at?: string
          departemen?: string
          email?: string | null
          foto_profil?: string | null
          foto_url?: string | null
          id?: string
          jabatan?: string
          nama_lengkap?: string
          nomor_id_trainer?: string
          nomor_whatsapp?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status_trainer?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      training_days: {
        Row: {
          aktif: boolean
          created_at: string
          id: string
          nama: string
          urutan: number
        }
        Insert: {
          aktif?: boolean
          created_at?: string
          id?: string
          nama: string
          urutan?: number
        }
        Update: {
          aktif?: boolean
          created_at?: string
          id?: string
          nama?: string
          urutan?: number
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
      whatsapp_messages: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          media_storage_path: string | null
          media_url: string | null
          message_id: string | null
          nama_pengirim: string | null
          nomor_pengirim: string
          pesan: string | null
          raw_payload: Json | null
          status: string
          timestamp_pesan: string | null
          trainer_id: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          media_storage_path?: string | null
          media_url?: string | null
          message_id?: string | null
          nama_pengirim?: string | null
          nomor_pengirim: string
          pesan?: string | null
          raw_payload?: Json | null
          status?: string
          timestamp_pesan?: string | null
          trainer_id?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          media_storage_path?: string | null
          media_url?: string | null
          message_id?: string | null
          nama_pengirim?: string | null
          nomor_pengirim?: string
          pesan?: string | null
          raw_payload?: Json | null
          status?: string
          timestamp_pesan?: string | null
          trainer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_trainer_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "trainer"
      report_source: "manual" | "whatsapp" | "import"
      report_status:
        | "draft"
        | "menunggu_konfirmasi"
        | "terkirim"
        | "menunggu_verifikasi"
        | "terverifikasi"
        | "perlu_revisi"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "supervisor", "trainer"],
      report_source: ["manual", "whatsapp", "import"],
      report_status: [
        "draft",
        "menunggu_konfirmasi",
        "terkirim",
        "menunggu_verifikasi",
        "terverifikasi",
        "perlu_revisi",
      ],
    },
  },
} as const
