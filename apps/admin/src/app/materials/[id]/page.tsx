import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import type { MaterialAudience } from "@ipsi/types";
import { Button } from "@/components/ui/button";
import {
  MaterialDetailClient,
  type AssignedRow,
  type AvailableStudent,
  type MaterialDetail,
} from "./material-detail-client";

export const dynamic = "force-dynamic";

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: m } = await supabase
    .from("materials")
    .select(
      "id, title, description, audience, storage_path, file_name, file_size_bytes, is_published, published_at, expires_at, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!m) notFound();

  const detail: MaterialDetail = {
    id: m.id,
    title: m.title,
    description: m.description,
    audience: m.audience as MaterialAudience,
    file_name: m.file_name,
    file_size_bytes: m.file_size_bytes,
    is_published: m.is_published,
    published_at: m.published_at,
    expires_at: m.expires_at,
    created_at: m.created_at,
  };

  // 배정 학생 (audience=targeted일 때 의미 있음)
  const { data: assigns } = await supabase
    .from("material_assignments")
    .select("id, student_id, assigned_at, assigned_by_school")
    .eq("material_id", id);

  const studentIds = (assigns ?? []).map((a) => a.student_id);
  const { data: studentProfiles } =
    studentIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, phone, school, grade")
          .in("id", studentIds)
      : { data: [] };

  const profileMap = new Map(
    (studentProfiles ?? []).map((p) => [p.id, p] as const),
  );

  const assigned: AssignedRow[] = (assigns ?? []).map((a) => {
    const p = profileMap.get(a.student_id);
    return {
      assignment_id: a.id,
      student_id: a.student_id,
      full_name: p?.full_name ?? "(unknown)",
      school: p?.school ?? null,
      grade: p?.grade ?? null,
      assigned_at: a.assigned_at,
      assigned_by_school: a.assigned_by_school,
    };
  });

  const { data: allStudents } = await supabase
    .from("profiles")
    .select("id, full_name, phone, school, grade")
    .eq("role", "student")
    .eq("status", "approved")
    .order("full_name");

  const alreadyAssigned = new Set(studentIds);
  const availableStudents: AvailableStudent[] = (allStudents ?? [])
    .filter((s) => !alreadyAssigned.has(s.id))
    .map((s) => ({
      id: s.id,
      full_name: s.full_name,
      phone: s.phone,
      school: s.school,
      grade: s.grade,
    }));

  const distinctSchools = Array.from(
    new Set(
      (allStudents ?? [])
        .map((s) => s.school)
        .filter((v): v is string => !!v),
    ),
  ).sort();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/materials">
            <ChevronLeft className="size-4" />
            자료 목록
          </Link>
        </Button>
      </div>

      <MaterialDetailClient
        material={detail}
        assigned={assigned}
        availableStudents={availableStudents}
        distinctSchools={distinctSchools}
      />
    </div>
  );
}
