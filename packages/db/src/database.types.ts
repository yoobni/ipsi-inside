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

export type PassageSource =
  | "reading"          // 비문학(독서)
  | "literature"       // 문학
  | "speech_writing"   // 화법과작문
  | "language_media";  // 언어와매체

export type AttemptStatus = "in_progress" | "submitted";

export type QuestionChoice = { no: number; text: string };

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
          terms_agreed_at: string | null;
          privacy_agreed_at: string | null;
          marketing_agreed_at: string | null;
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
          terms_agreed_at?: string | null;
          privacy_agreed_at?: string | null;
          marketing_agreed_at?: string | null;
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
          terms_agreed_at?: string | null;
          privacy_agreed_at?: string | null;
          marketing_agreed_at?: string | null;
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

      // ─── 학생 그룹(반) ───────────────────────────────────────────────────────
      student_groups: {
        Row: {
          id: string;
          name: string;
          color: string | null;
          description: string | null;
          archived: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string | null;
          description?: string | null;
          archived?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string | null;
          description?: string | null;
          archived?: boolean;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      group_members: {
        Row: {
          group_id: string;
          student_id: string;
          added_by: string;
          added_at: string;
        };
        Insert: {
          group_id: string;
          student_id: string;
          added_by: string;
          added_at?: string;
        };
        Update: {
          group_id?: string;
          student_id?: string;
          added_by?: string;
          added_at?: string;
        };
        Relationships: [];
      };

      // ─── v2 시험 시스템 ──────────────────────────────────────────────────────
      passages: {
        Row: {
          id: string;
          title: string;
          source_type: PassageSource;
          content: string;            // HTML
          unit_major: string;
          unit_minor: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          source_type: PassageSource;
          content: string;
          unit_major: string;
          unit_minor?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          source_type?: PassageSource;
          content?: string;
          unit_major?: string;
          unit_minor?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          passage_id: string;
          position_in_passage: number;
          stem: string;                  // HTML
          supplementary: string | null;  // 〈보기〉 HTML
          choices: QuestionChoice[];     // jsonb
          correct_answer: number;
          points: number;
          difficulty: Difficulty | null;
          unit_minor: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          passage_id: string;
          position_in_passage: number;
          stem: string;
          supplementary?: string | null;
          choices: QuestionChoice[];
          correct_answer: number;
          points?: number;
          difficulty?: Difficulty | null;
          unit_minor?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          passage_id?: string;
          position_in_passage?: number;
          stem?: string;
          supplementary?: string | null;
          choices?: QuestionChoice[];
          correct_answer?: number;
          points?: number;
          difficulty?: Difficulty | null;
          unit_minor?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      test_sheets: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          target_school: string | null;
          target_grade: number | null;
          open_at: string | null;
          due_at: string | null;
          allow_retake: boolean;
          max_attempts: number | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          target_school?: string | null;
          target_grade?: number | null;
          open_at?: string | null;
          due_at?: string | null;
          allow_retake?: boolean;
          max_attempts?: number | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          target_school?: string | null;
          target_grade?: number | null;
          open_at?: string | null;
          due_at?: string | null;
          allow_retake?: boolean;
          max_attempts?: number | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      test_sheet_questions: {
        Row: {
          id: string;
          test_sheet_id: string;
          question_id: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          test_sheet_id: string;
          question_id: string;
          position: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          test_sheet_id?: string;
          question_id?: string;
          position?: number;
          created_at?: string;
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
          assigned_by_school: string | null;
        };
        Insert: {
          id?: string;
          test_sheet_id: string;
          student_id: string;
          assigned_by: string;
          assigned_at?: string;
          assigned_by_school?: string | null;
        };
        Update: {
          id?: string;
          test_sheet_id?: string;
          student_id?: string;
          assigned_by?: string;
          assigned_at?: string;
          assigned_by_school?: string | null;
        };
        Relationships: [];
      };
      test_attempts: {
        Row: {
          id: string;
          assignment_id: string;
          attempt_no: number;
          started_at: string;
          submitted_at: string | null;
          score: number | null;
          total_points: number | null;
          status: AttemptStatus;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          attempt_no: number;
          started_at?: string;
          submitted_at?: string | null;
          score?: number | null;
          total_points?: number | null;
          status?: AttemptStatus;
        };
        Update: {
          id?: string;
          assignment_id?: string;
          attempt_no?: number;
          started_at?: string;
          submitted_at?: string | null;
          score?: number | null;
          total_points?: number | null;
          status?: AttemptStatus;
        };
        Relationships: [];
      };
      student_answers: {
        Row: {
          id: string;
          attempt_id: string;
          question_id: string;
          selected: number | null;
          is_correct: boolean | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          question_id: string;
          selected?: number | null;
          is_correct?: boolean | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          attempt_id?: string;
          question_id?: string;
          selected?: number | null;
          is_correct?: boolean | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ─── 일일 마킹 / 학습 일지 ──────────────────────────────────────────────
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
          content: string | null;
          class_question: string | null;
          test_question: string | null;
          message_to_teacher: string | null;
          learning_log: string | null;
          submitted_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          journal_date: string;
          content?: string | null;
          class_question?: string | null;
          test_question?: string | null;
          message_to_teacher?: string | null;
          learning_log?: string | null;
          submitted_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          journal_date?: string;
          content?: string | null;
          class_question?: string | null;
          test_question?: string | null;
          message_to_teacher?: string | null;
          learning_log?: string | null;
          submitted_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      announcements: {
        Row: {
          id: string;
          title: string;
          body: string | null;
          audience: "all" | "student" | "parent";
          is_published: boolean;
          published_at: string | null;
          expires_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body?: string | null;
          audience?: "all" | "student" | "parent";
          is_published?: boolean;
          published_at?: string | null;
          expires_at?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          body?: string | null;
          audience?: "all" | "student" | "parent";
          is_published?: boolean;
          published_at?: string | null;
          expires_at?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          link: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          body?: string | null;
          link?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          body?: string | null;
          link?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      materials: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          audience: "all" | "student" | "parent" | "targeted";
          storage_path: string;
          file_name: string;
          file_size_bytes: number;
          is_published: boolean;
          published_at: string | null;
          expires_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          audience?: "all" | "student" | "parent" | "targeted";
          storage_path: string;
          file_name: string;
          file_size_bytes: number;
          is_published?: boolean;
          published_at?: string | null;
          expires_at?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          audience?: "all" | "student" | "parent" | "targeted";
          storage_path?: string;
          file_name?: string;
          file_size_bytes?: number;
          is_published?: boolean;
          published_at?: string | null;
          expires_at?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      material_assignments: {
        Row: {
          id: string;
          material_id: string;
          student_id: string;
          assigned_by: string;
          assigned_by_school: string | null;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          material_id: string;
          student_id: string;
          assigned_by: string;
          assigned_by_school?: string | null;
          assigned_at?: string;
        };
        Update: {
          id?: string;
          material_id?: string;
          student_id?: string;
          assigned_by?: string;
          assigned_by_school?: string | null;
          assigned_at?: string;
        };
        Relationships: [];
      };
      material_downloads: {
        Row: {
          id: string;
          material_id: string;
          user_id: string;
          source: "download" | "view";
          downloaded_at: string;
        };
        Insert: {
          id?: string;
          material_id: string;
          user_id: string;
          source?: "download" | "view";
          downloaded_at?: string;
        };
        Update: {
          id?: string;
          material_id?: string;
          user_id?: string;
          source?: "download" | "view";
          downloaded_at?: string;
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
    };
    Views: Record<string, never>;
    Functions: {
      current_profile_role: { Args: Record<string, never>; Returns: string };
      current_profile_status: { Args: Record<string, never>; Returns: string };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      attempt_total_score: {
        Args: { p_attempt_id: string };
        Returns: {
          total_questions: number;
          correct_count: number;
          total_points: number;
          earned_points: number;
          score_percent: number;
        }[];
      };
      attempt_unit_stats: {
        Args: { p_attempt_id: string };
        Returns: {
          unit_major: string;
          unit_minor: string | null;
          total: number;
          correct: number;
          accuracy: number;
        }[];
      };
    };
    Enums: {
      passage_source: PassageSource;
    };
  };
};
