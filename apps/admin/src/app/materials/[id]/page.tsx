import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download, Eye } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import type { MaterialAudience } from "@ipsi/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  // 그룹 목록(멤버 수 포함) + 이 자료의 타깃 그룹
  const [{ data: groups }, { data: memberships }, { data: groupTargets }] =
    await Promise.all([
      supabase
        .from("student_groups")
        .select("id, name")
        .eq("archived", false)
        .order("name"),
      supabase.from("group_members").select("group_id"),
      supabase
        .from("material_group_targets")
        .select("group_id")
        .eq("material_id", id),
    ]);
  const countByGroup = new Map<string, number>();
  (memberships ?? []).forEach((mm) =>
    countByGroup.set(mm.group_id, (countByGroup.get(mm.group_id) ?? 0) + 1),
  );
  const groupOptions = (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    member_count: countByGroup.get(g.id) ?? 0,
  }));
  const targetGroupIds = (groupTargets ?? []).map((t) => t.group_id);

  // 다운로드/뷰 이력 — 최근 100건
  const { data: downloadRows } = await supabase
    .from("material_downloads")
    .select("id, user_id, source, downloaded_at")
    .eq("material_id", id)
    .order("downloaded_at", { ascending: false })
    .limit(100);

  const downloadUserIds = Array.from(
    new Set((downloadRows ?? []).map((r) => r.user_id)),
  );
  const { data: dlProfiles } =
    downloadUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, role, school")
          .in("id", downloadUserIds)
      : { data: [] };
  const dlProfileMap = new Map(
    (dlProfiles ?? []).map((p) => [p.id, p] as const),
  );

  // 자료별 사용자당 액션 카운트 (distinct user 기준 + 학생 한정 미수령 diff)
  const downloadedStudentIds = new Set<string>();
  (downloadRows ?? []).forEach((r) => {
    const p = dlProfileMap.get(r.user_id);
    if (p?.role === "student") downloadedStudentIds.add(r.user_id);
  });

  // targeted일 때 미수령 학생 = 배정됐는데 다운로드/뷰 안 한 학생
  const notDownloadedAssigned = assigned.filter(
    (a) => !downloadedStudentIds.has(a.student_id),
  );

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
        groups={groupOptions}
        targetGroupIds={targetGroupIds}
      />

      {detail.audience === "targeted" && assigned.length > 0 && (
        <section className="rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">수령 현황</h2>
              <Badge variant="primary">
                {downloadedStudentIds.size}/{assigned.length}명 수령
              </Badge>
            </div>
          </div>
          {notDownloadedAssigned.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              모든 배정 학생이 수령했어요.
            </p>
          ) : (
            <ul className="divide-y">
              {notDownloadedAssigned.map((a) => (
                <li
                  key={a.assignment_id}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <span className="font-medium">{a.full_name}</span>
                  <span className="text-muted-foreground text-xs">
                    {a.school}
                    {a.grade ? ` · ${a.grade}학년` : ""} · 미수령
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">다운로드 / 열람 이력</h2>
            <Badge variant="outline">최근 {downloadRows?.length ?? 0}건</Badge>
          </div>
        </div>
        {(downloadRows ?? []).length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            아직 이력이 없어요.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">사용자</TableHead>
                <TableHead>역할</TableHead>
                <TableHead>액션</TableHead>
                <TableHead className="pr-4 text-right">시각</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(downloadRows ?? []).map((r) => {
                const p = dlProfileMap.get(r.user_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="pl-4">
                      <div className="font-medium">
                        {p?.full_name ?? "(알 수 없음)"}
                      </div>
                      {p?.school && (
                        <div className="text-muted-foreground text-xs">
                          {p.school}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {p?.role === "student"
                        ? "학생"
                        : p?.role === "parent"
                          ? "학부모"
                          : p?.role ?? "—"}
                    </TableCell>
                    <TableCell>
                      {r.source === "download" ? (
                        <Badge variant="primary">
                          <Download className="size-3" /> 다운로드
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Eye className="size-3" /> 열람
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground pr-4 text-right text-xs tabular-nums">
                      {formatDt(r.downloaded_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

function formatDt(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
