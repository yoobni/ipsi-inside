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

/** 주간 플래너 — 발행 전 초안은 학생에게 보이지 않음 */
export type PlannerWeekStatus = "draft" | "published";
/** fixed=타 과목/고정 일정(색상 블록만), korean=국어 시간(세부 과제를 가짐) */
export type PlannerBlockKind = "korean" | "fixed";
/** O(제시간 완료) / △(당일 완료, 시간 미준수) / X(미수행) */
export type PlannerCheckStatus = "done" | "late" | "missed";

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
          must_change_password: boolean;
          // role='admin'일 때만 값이 있다(owner|assistant). 학생·학부모는 null.
          admin_level: "owner" | "assistant" | null;
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
          must_change_password?: boolean;
          admin_level?: "owner" | "assistant" | null;
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
          must_change_password?: boolean;
          admin_level?: "owner" | "assistant" | null;
        };
        Relationships: [];
      };
      // ─── 조교 권한·범위 (원장만 쓴다, 조교는 본인 행 읽기만) ─────────────────
      staff_settings: {
        Row: {
          staff_id: string;
          permissions: string[];
          scope_mode: "all" | "scoped";
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          staff_id: string;
          permissions?: string[];
          scope_mode?: "all" | "scoped";
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          staff_id?: string;
          permissions?: string[];
          scope_mode?: "all" | "scoped";
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_student_scope: {
        Row: { staff_id: string; student_id: string; added_by: string | null; added_at: string };
        Insert: { staff_id: string; student_id: string; added_by?: string | null; added_at?: string };
        Update: { staff_id?: string; student_id?: string; added_by?: string | null; added_at?: string };
        Relationships: [];
      };
      staff_group_scope: {
        Row: { staff_id: string; group_id: string; added_by: string | null; added_at: string };
        Insert: { staff_id: string; group_id: string; added_by?: string | null; added_at?: string };
        Update: { staff_id?: string; group_id?: string; added_by?: string | null; added_at?: string };
        Relationships: [];
      };
      // ─── 관리 필요 감지 (20261008080000) ──────────────────────────────────
      risk_rules: {
        Row: { key: string; label: string; description: string; enabled: boolean; threshold: number; lookback_days: number; position: number; updated_by: string | null; updated_at: string };
        Insert: { key: string; label: string; description: string; enabled?: boolean; threshold: number; lookback_days: number; position?: number; updated_by?: string | null; updated_at?: string };
        Update: { key?: string; label?: string; description?: string; enabled?: boolean; threshold?: number; lookback_days?: number; position?: number; updated_by?: string | null; updated_at?: string };
        Relationships: [];
      };
      risk_acknowledgements: {
        Row: { id: string; student_id: string; rule_key: string; acked_by: string | null; note: string | null; until: string; created_at: string };
        Insert: { id?: string; student_id: string; rule_key: string; acked_by?: string | null; note?: string | null; until: string; created_at?: string };
        Update: { id?: string; student_id?: string; rule_key?: string; acked_by?: string | null; note?: string | null; until?: string; created_at?: string };
        Relationships: [];
      };
      risk_snapshots: {
        Row: { snapshot_date: string; student_id: string; flags: Json };
        Insert: { snapshot_date: string; student_id: string; flags: Json };
        Update: { snapshot_date?: string; student_id?: string; flags?: Json };
        Relationships: [];
      };
      // ─── TOP3 랭킹 설정 (싱글턴 id=1, 원장만) ──────────────────────────────
      ranking_settings: {
        Row: {
          id: number;
          name_display: "masked" | "full";
          scope: "all" | "group";
          show_homework: boolean;
          show_attendance: boolean;
          show_growth: boolean;
          show_test: boolean;
          featured_test_sheet_id: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name_display?: "masked" | "full";
          scope?: "all" | "group";
          show_homework?: boolean;
          show_attendance?: boolean;
          show_growth?: boolean;
          show_test?: boolean;
          featured_test_sheet_id?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name_display?: "masked" | "full";
          scope?: "all" | "group";
          show_homework?: boolean;
          show_attendance?: boolean;
          show_growth?: boolean;
          show_test?: boolean;
          featured_test_sheet_id?: string | null;
          updated_by?: string | null;
          updated_at?: string;
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

      // ─── 동의 이력 (append-only, 쓰기는 서버만) ──────────────────────────────
      consent_records: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          doc_version: string;
          agreed: boolean;
          agreed_at: string;
          ip: string | null;
          user_agent: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: string;
          doc_version: string;
          agreed: boolean;
          agreed_at?: string;
          ip?: string | null;
          user_agent?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: string;
          doc_version?: string;
          agreed?: boolean;
          agreed_at?: string;
          ip?: string | null;
          user_agent?: string | null;
        };
        Relationships: [];
      };

      // ─── 접속기록 (안전성 확보조치 고시 제8조) ──────────────────────────────
      // 쓰기는 service_role만 — RLS에 insert 정책이 없다.
      admin_access_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          detail: Json | null;
          ip: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          detail?: Json | null;
          ip?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          target_type?: string | null;
          target_id?: string | null;
          detail?: Json | null;
          ip?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      // ─── 인증 시도 카운터 ───────────────────────────────────────────────────
      // 직접 select/insert 하지 않는다 — consume_rate_limit()으로만 만진다.
      rate_limit_hits: {
        Row: {
          bucket: string;
          count: number;
          window_started_at: string;
        };
        Insert: {
          bucket: string;
          count: number;
          window_started_at?: string;
        };
        Update: {
          bucket?: string;
          count?: number;
          window_started_at?: string;
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
          work_id: string | null;
          source_id: string | null;
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
          work_id?: string | null;
          source_id?: string | null;
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
          work_id?: string | null;
          source_id?: string | null;
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
          type_id: string | null;
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
          type_id?: string | null;
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
          type_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      // ─── 문항 태그 체계 (20261008060000) ──────────────────────────────────
      question_types: {
        Row: { id: string; area: PassageSource; label: string; position: number; archived: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; area: PassageSource; label: string; position?: number; archived?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: string; area?: PassageSource; label?: string; position?: number; archived?: boolean; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      works: {
        Row: { id: string; title: string; author: string | null; genre: string | null; era: string | null; archived: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; title: string; author?: string | null; genre?: string | null; era?: string | null; archived?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: string; title?: string; author?: string | null; genre?: string | null; era?: string | null; archived?: boolean; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      exam_sources: {
        Row: { id: string; label: string; year: number | null; month: number | null; exam_kind: string | null; grade: number | null; archived: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; label: string; year?: number | null; month?: number | null; exam_kind?: string | null; grade?: number | null; archived?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: string; label?: string; year?: number | null; month?: number | null; exam_kind?: string | null; grade?: number | null; archived?: boolean; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      concepts: {
        Row: { id: string; title: string; area: PassageSource | null; parent_id: string | null; body_html: string | null; position: number; archived: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; title: string; area?: PassageSource | null; parent_id?: string | null; body_html?: string | null; position?: number; archived?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: string; title?: string; area?: PassageSource | null; parent_id?: string | null; body_html?: string | null; position?: number; archived?: boolean; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      question_concepts: {
        Row: { question_id: string; concept_id: string };
        Insert: { question_id: string; concept_id: string };
        Update: { question_id?: string; concept_id?: string };
        Relationships: [];
      };
      question_explanations: {
        Row: { question_id: string; body: string; updated_by: string | null; updated_at: string };
        Insert: { question_id: string; body: string; updated_by?: string | null; updated_at?: string };
        Update: { question_id?: string; body?: string; updated_by?: string | null; updated_at?: string };
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
          audience: "all" | "student" | "parent" | "targeted" | "group";
          storage_path: string | null;
          file_name: string | null;
          file_size_bytes: number | null;
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
          audience?: "all" | "student" | "parent" | "targeted" | "group";
          storage_path?: string | null;
          file_name?: string | null;
          file_size_bytes?: number | null;
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
          audience?: "all" | "student" | "parent" | "targeted" | "group";
          storage_path?: string | null;
          file_name?: string | null;
          file_size_bytes?: number | null;
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
      material_files: {
        Row: {
          id: string;
          material_id: string;
          storage_path: string;
          file_name: string;
          file_size_bytes: number;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          material_id: string;
          storage_path: string;
          file_name: string;
          file_size_bytes: number;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          material_id?: string;
          storage_path?: string;
          file_name?: string;
          file_size_bytes?: number;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      material_group_targets: {
        Row: {
          material_id: string;
          group_id: string;
          added_by: string;
          added_at: string;
        };
        Insert: {
          material_id: string;
          group_id: string;
          added_by: string;
          added_at?: string;
        };
        Update: {
          material_id?: string;
          group_id?: string;
          added_by?: string;
          added_at?: string;
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
      // ─── 칼럼 (원장 글 + 읽기완료 추적) ─────────────────────────────────────
      columns: {
        Row: {
          id: string;
          title: string;
          body: string;
          category_id: string | null;
          is_published: boolean;
          published_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body: string;
          category_id?: string | null;
          is_published?: boolean;
          published_at?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          body?: string;
          category_id?: string | null;
          is_published?: boolean;
          published_at?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      column_categories: {
        Row: {
          id: string;
          label: string;
          position: number;
          archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          label: string;
          position?: number;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          label?: string;
          position?: number;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      column_reads: {
        Row: { column_id: string; student_id: string; read_at: string };
        Insert: { column_id: string; student_id: string; read_at?: string };
        Update: { column_id?: string; student_id?: string; read_at?: string };
        Relationships: [];
      };

      // ─── Q&A ────────────────────────────────────────────────────────────────
      qna_categories: {
        Row: {
          id: string;
          label: string;
          placeholder: string | null;
          needs_reference: boolean;
          position: number;
          archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          label: string;
          placeholder?: string | null;
          needs_reference?: boolean;
          position?: number;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          label?: string;
          placeholder?: string | null;
          needs_reference?: boolean;
          position?: number;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      qna_questions: {
        Row: {
          id: string;
          student_id: string;
          category_id: string | null;
          reference_label: string | null;
          question_no: string | null;
          body: string;
          image_path: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          category_id?: string | null;
          reference_label?: string | null;
          question_no?: string | null;
          body: string;
          image_path?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          category_id?: string | null;
          reference_label?: string | null;
          question_no?: string | null;
          body?: string;
          image_path?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      qna_answers: {
        Row: {
          id: string;
          question_id: string;
          ai_draft: string | null;
          body: string;
          answered_by: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          ai_draft?: string | null;
          body: string;
          answered_by?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          question_id?: string;
          ai_draft?: string | null;
          body?: string;
          answered_by?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      qna_question_stars: {
        Row: {
          question_id: string;
          starred_by: string | null;
          created_at: string;
        };
        Insert: {
          question_id: string;
          starred_by?: string | null;
          created_at?: string;
        };
        Update: {
          question_id?: string;
          starred_by?: string | null;
          created_at?: string;
        };
        // 어드민 Q&A 목록이 qna_questions 쪽에서 `qna_question_stars(question_id)`로
        // 임베드한다 — 수백 개 id를 .in()으로 넘기지 않기 위해.
        Relationships: [
          {
            foreignKeyName: "qna_question_stars_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: true;
            referencedRelation: "qna_questions";
            referencedColumns: ["id"];
          },
        ];
      };

      planner_weeks: {
        Row: {
          id: string;
          student_id: string;
          week_start: string;
          status: PlannerWeekStatus;
          published_at: string | null;
          weekly_comment: string | null;
          comment_written_by: string | null;
          comment_written_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          week_start: string;
          status?: PlannerWeekStatus;
          published_at?: string | null;
          weekly_comment?: string | null;
          comment_written_by?: string | null;
          comment_written_at?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          week_start?: string;
          status?: PlannerWeekStatus;
          published_at?: string | null;
          weekly_comment?: string | null;
          comment_written_by?: string | null;
          comment_written_at?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      planner_blocks: {
        Row: {
          id: string;
          week_id: string;
          day_of_week: number;
          start_min: number;
          end_min: number;
          kind: PlannerBlockKind;
          label: string | null;
          color: string | null;
          memo: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          week_id: string;
          day_of_week: number;
          start_min: number;
          end_min: number;
          kind: PlannerBlockKind;
          label?: string | null;
          color?: string | null;
          memo?: string | null;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          week_id?: string;
          day_of_week?: number;
          start_min?: number;
          end_min?: number;
          kind?: PlannerBlockKind;
          label?: string | null;
          color?: string | null;
          memo?: string | null;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      planner_tags: {
        Row: {
          id: string;
          name: string;
          color: string | null;
          position: number;
          archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string | null;
          position?: number;
          archived?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string | null;
          position?: number;
          archived?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      planner_tasks: {
        Row: {
          id: string;
          block_id: string;
          tag_id: string | null;
          title: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          block_id: string;
          tag_id?: string | null;
          title: string;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          block_id?: string;
          tag_id?: string | null;
          title?: string;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      planner_task_checks: {
        Row: {
          id: string;
          task_id: string;
          student_id: string;
          task_date: string;
          status: PlannerCheckStatus;
          late_reason: string | null;
          photo_path: string | null;
          checked_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          student_id: string;
          task_date: string;
          status: PlannerCheckStatus;
          late_reason?: string | null;
          photo_path?: string | null;
          checked_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          student_id?: string;
          task_date?: string;
          status?: PlannerCheckStatus;
          late_reason?: string | null;
          photo_path?: string | null;
          checked_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      planner_templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          payload: Json;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          payload: Json;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          payload?: Json;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_profile_role: { Args: Record<string, never>; Returns: string };
      current_profile_status: { Args: Record<string, never>; Returns: string };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      // 원장/조교 분리 — is_admin()은 "승인된 교직원 전체"로 남겨두고 아래로 좁힌다.
      is_owner: { Args: Record<string, never>; Returns: boolean };
      is_assistant: { Args: Record<string, never>; Returns: boolean };
      staff_has_permission: { Args: { p_permission: string }; Returns: boolean };
      staff_can_access_student: { Args: { p_student_id: string }; Returns: boolean };
      staff_can_access_profile: { Args: { p_profile_id: string }; Returns: boolean };
      staff_can_access_group: { Args: { p_group_id: string }; Returns: boolean };
      planner_task_date: { Args: { p_task_id: string }; Returns: string };
      planner_task_student: { Args: { p_task_id: string }; Returns: string };
      // 주간 이행 통계 — jsonb 한 덩어리. 형태는 @ipsi/types의
      // plannerWeekStatsSchema로 파싱해서 쓴다 (보이지 않는 주차는 null).
      planner_week_stats: { Args: { p_week_id: string }; Returns: Json };
      // 학생 학습 리포트 집계 — @ipsi/types studentStatsSchema로 파싱.
      // 본인·연결 학부모·교직원이 아니면 null.
      student_stats: { Args: { p_student: string }; Returns: Json };
      // TOP3 보드 — @ipsi/types top3BoardsSchema로 파싱. p_student 없으면 호출자 본인,
      // p_group은 교직원 미리보기 전용.
      top3_boards: {
        Args: { p_student?: string | null; p_group?: string | null };
        Returns: Json;
      };
      ranking_mask_name: { Args: { p_name: string }; Returns: string };
      // 시험 분석 — @ipsi/types attemptAnalysisSchema / choiceDistributionSchema 로 파싱.
      attempt_analysis: { Args: { p_attempt_id: string }; Returns: Json };
      // 조교 대시보드·관리 필요 — @ipsi/types staffDashboardSchema / riskFlagsSchema
      staff_dashboard: { Args: Record<string, never>; Returns: Json };
      student_risk_flags: {
        Args: { p_student_ids?: string[] | null; p_include_acked?: boolean };
        Returns: Json;
      };
      sheet_choice_distribution: { Args: { p_sheet_id: string }; Returns: Json };
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
      // 시험 제출 — 소유 확인·채점·기록을 원자적으로. 학생에게 UPDATE 권한을
      // 주지 않기 위해 SECURITY DEFINER로 뺐다 (보안조사 H-1).
      submit_attempt: {
        Args: { p_attempt_id: string };
        Returns: { score: number; total_points: number }[];
      };
      // 인증 시도 제한 — 증가와 판정이 한 문장에서 끝난다(경합 없음).
      consume_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_sec: number };
        Returns: { allowed: boolean; retry_after_sec: number }[];
      };
      prune_rate_limit_hits: { Args: Record<string, never>; Returns: undefined };
      prune_admin_access_logs: {
        Args: Record<string, never>;
        Returns: undefined;
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
