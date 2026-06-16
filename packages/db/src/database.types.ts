// Manually maintained until `supabase gen types` runs against the linked project.
// Run `pnpm db:types` after `supabase login` to regenerate.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Role = "admin" | "student" | "parent";
export type ProfileStatus = "pending" | "approved" | "rejected" | "suspended";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: Role;
          status: ProfileStatus;
          full_name: string;
          phone: string;
          school: string | null;
          grade: number | null;
          created_at: string;
          approved_at: string | null;
          approved_by: string | null;
        };
        Insert: {
          id: string;
          role: Role;
          status?: ProfileStatus;
          full_name: string;
          phone: string;
          school?: string | null;
          grade?: number | null;
          created_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
        };
        Update: {
          id?: string;
          role?: Role;
          status?: ProfileStatus;
          full_name?: string;
          phone?: string;
          school?: string | null;
          grade?: number | null;
          created_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
        };
        Relationships: [];
      };
      parent_student_links: {
        Row: {
          parent_id: string;
          student_id: string;
          created_at: string;
        };
        Insert: {
          parent_id: string;
          student_id: string;
          created_at?: string;
        };
        Update: {
          parent_id?: string;
          student_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      parent_signup_requests: {
        Row: {
          parent_id: string;
          student_full_name: string;
          student_phone: string;
          matched_student_id: string | null;
          created_at: string;
        };
        Insert: {
          parent_id: string;
          student_full_name: string;
          student_phone: string;
          matched_student_id?: string | null;
          created_at?: string;
        };
        Update: {
          parent_id?: string;
          student_full_name?: string;
          student_phone?: string;
          matched_student_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_profile_role: { Args: Record<string, never>; Returns: string };
      current_profile_status: { Args: Record<string, never>; Returns: string };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
  };
};
