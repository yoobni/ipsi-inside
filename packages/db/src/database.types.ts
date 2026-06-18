// Manually maintained until `supabase gen types` runs against the linked project.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Role = "admin" | "student" | "parent";
export type ProfileStatus = "pending" | "approved" | "rejected" | "suspended";

export type UnitMajor = "문법" | "문학" | "독서" | "화작" | "언매" | (string & {});
export type Difficulty = "상" | "중" | "하";
export type AssignmentStatus = "assigned" | "graded";

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
        Row: { parent_id: string; student_id: string; created_at: string };
        Insert: { parent_id: string; student_id: string; created_at?: string };
        Update: { parent_id?: string; student_id?: string; created_at?: string };
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
      test_sheets: {
        Row: {
          id: string;
          title: string;
          target_school: string | null;
          target_grade: number | null;
          test_date: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          target_school?: string | null;
          target_grade?: number | null;
          test_date?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          target_school?: string | null;
          target_grade?: number | null;
          test_date?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      test_questions: {
        Row: {
          id: string;
          test_sheet_id: string;
          question_no: number;
          correct_answer: number;
          unit_major: string;
          unit_minor: string | null;
          difficulty: Difficulty | null;
          points: number;
        };
        Insert: {
          id?: string;
          test_sheet_id: string;
          question_no: number;
          correct_answer: number;
          unit_major: string;
          unit_minor?: string | null;
          difficulty?: Difficulty | null;
          points?: number;
        };
        Update: {
          id?: string;
          test_sheet_id?: string;
          question_no?: number;
          correct_answer?: number;
          unit_major?: string;
          unit_minor?: string | null;
          difficulty?: Difficulty | null;
          points?: number;
        };
        Relationships: [];
      };
      test_assignments: {
        Row: {
          id: string;
          test_sheet_id: string;
          student_id: string;
          assigned_by: string;
          assigned_at: string;
          due_at: string | null;
          status: AssignmentStatus;
        };
        Insert: {
          id?: string;
          test_sheet_id: string;
          student_id: string;
          assigned_by: string;
          assigned_at?: string;
          due_at?: string | null;
          status?: AssignmentStatus;
        };
        Update: {
          id?: string;
          test_sheet_id?: string;
          student_id?: string;
          assigned_by?: string;
          assigned_at?: string;
          due_at?: string | null;
          status?: AssignmentStatus;
        };
        Relationships: [];
      };
      daily_attendance: {
        Row: {
          id: string;
          student_id: string;
          date: string;
          attendance: "present" | "late" | "absent" | null;
          homework_grade: "S" | "A" | "B" | "F" | null;
          test_score: number | null;
          note: string | null;
          updated_by: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          date: string;
          attendance?: "present" | "late" | "absent" | null;
          homework_grade?: "S" | "A" | "B" | "F" | null;
          test_score?: number | null;
          note?: string | null;
          updated_by: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          date?: string;
          attendance?: "present" | "late" | "absent" | null;
          homework_grade?: "S" | "A" | "B" | "F" | null;
          test_score?: number | null;
          note?: string | null;
          updated_by?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      study_journals: {
        Row: {
          id: string;
          student_id: string;
          journal_date: string;
          content: string;
          submitted_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          journal_date: string;
          content: string;
          submitted_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          journal_date?: string;
          content?: string;
          submitted_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      journal_feedbacks: {
        Row: {
          id: string;
          journal_id: string;
          overall_comment: string | null;
          better_than_yesterday: string | null;
          worse_than_yesterday: string | null;
          must_fix_tomorrow: string | null;
          written_by: string;
          written_at: string;
          updated_at: string;
          publish_at: string | null;
        };
        Insert: {
          id?: string;
          journal_id: string;
          overall_comment?: string | null;
          better_than_yesterday?: string | null;
          worse_than_yesterday?: string | null;
          must_fix_tomorrow?: string | null;
          written_by: string;
          written_at?: string;
          updated_at?: string;
          publish_at?: string | null;
        };
        Update: {
          id?: string;
          journal_id?: string;
          overall_comment?: string | null;
          better_than_yesterday?: string | null;
          worse_than_yesterday?: string | null;
          must_fix_tomorrow?: string | null;
          written_by?: string;
          written_at?: string;
          updated_at?: string;
          publish_at?: string | null;
        };
        Relationships: [];
      };
      student_answers: {
        Row: {
          id: string;
          test_sheet_id: string;
          student_id: string;
          question_no: number;
          selected: number | null;
          is_correct: boolean;
          marked_by: string;
          marked_at: string;
        };
        Insert: {
          id?: string;
          test_sheet_id: string;
          student_id: string;
          question_no: number;
          selected?: number | null;
          is_correct?: boolean;
          marked_by: string;
          marked_at?: string;
        };
        Update: {
          id?: string;
          test_sheet_id?: string;
          student_id?: string;
          question_no?: number;
          selected?: number | null;
          is_correct?: boolean;
          marked_by?: string;
          marked_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_profile_role: { Args: Record<string, never>; Returns: string };
      current_profile_status: { Args: Record<string, never>; Returns: string };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      test_unit_stats: {
        Args: { p_test_sheet_id: string; p_student_id: string };
        Returns: {
          unit_major: string;
          unit_minor: string | null;
          total: number;
          correct: number;
          accuracy: number;
        }[];
      };
      test_total_score: {
        Args: { p_test_sheet_id: string; p_student_id: string };
        Returns: {
          total_questions: number;
          correct_count: number;
          total_points: number;
          earned_points: number;
          score_percent: number;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
};
