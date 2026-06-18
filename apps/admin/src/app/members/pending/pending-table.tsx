"use client";

import { useMemo, useState, useTransition } from "react";
import { Calendar, GraduationCap, Phone, School, UserCircle2 } from "lucide-react";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { approveProfileAction, rejectProfileAction } from "./actions";

type PendingProfile = {
  id: string;
  role: string;
  status: string;
  full_name: string;
  phone: string;
  school: string | null;
  grade: number | null;
  created_at: string;
};
type ParentRequest = {
  parent_id: string;
  student_full_name: string;
  student_phone: string;
};
type ApprovedStudent = {
  id: string;
  full_name: string;
  phone: string;
  school: string | null;
  grade: number | null;
};

type TabValue = "all" | "student" | "parent";

export function PendingTable({
  profiles,
  parentRequests,
  approvedStudents,
  studentCount,
  parentCount,
}: {
  profiles: PendingProfile[];
  parentRequests: ParentRequest[];
  approvedStudents: ApprovedStudent[];
  studentCount: number;
  parentCount: number;
}) {
  const [tab, setTab] = useState<TabValue>("all");
  const [selected, setSelected] = useState<PendingProfile | null>(null);

  const requestById = useMemo(() => {
    const map = new Map<string, ParentRequest>();
    parentRequests.forEach((r) => map.set(r.parent_id, r));
    return map;
  }, [parentRequests]);

  const filtered = useMemo(() => {
    if (tab === "all") return profiles;
    return profiles.filter((p) => p.role === tab);
  }, [tab, profiles]);

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="all">전체 {profiles.length}</TabsTrigger>
          <TabsTrigger value="student">학생 {studentCount}</TabsTrigger>
          <TabsTrigger value="parent">학부모 {parentCount}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[88px] pl-4">유형</TableHead>
              <TableHead>이름</TableHead>
              <TableHead>연락처</TableHead>
              <TableHead>소속</TableHead>
              <TableHead className="pr-4 text-right">신청일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground h-24 text-center"
                >
                  {tab === "all"
                    ? "대기 중인 가입 신청이 없습니다."
                    : tab === "student"
                      ? "대기 중인 학생이 없습니다."
                      : "대기 중인 학부모가 없습니다."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow
                  key={p.id}
                  data-state={selected?.id === p.id ? "selected" : undefined}
                  className="cursor-pointer"
                  onClick={() => setSelected(p)}
                >
                  <TableCell className="pl-4">
                    <Badge variant={p.role === "student" ? "default" : "primary"}>
                      {p.role === "student" ? "학생" : "학부모"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.phone}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.role === "student"
                      ? `${p.school ?? "-"}${p.grade ? ` · ${p.grade}학년` : ""}`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground pr-4 text-right">
                    {formatDate(p.created_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PendingDrawer
        profile={selected}
        parentRequest={
          selected?.role === "parent" ? requestById.get(selected.id) : undefined
        }
        approvedStudents={approvedStudents}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function PendingDrawer({
  profile,
  parentRequest,
  approvedStudents,
  onClose,
}: {
  profile: PendingProfile | null;
  parentRequest?: ParentRequest;
  approvedStudents: ApprovedStudent[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [matchedStudentId, setMatchedStudentId] = useState<string>("");
  const [lastId, setLastId] = useState<string | null>(null);

  const { candidates, others } = useMemo(() => {
    if (!parentRequest) return { candidates: [], others: approvedStudents };
    const ids = new Set<string>();
    const cs = approvedStudents.filter((s) => {
      const match =
        s.full_name === parentRequest.student_full_name ||
        s.phone === parentRequest.student_phone;
      if (match) ids.add(s.id);
      return match;
    });
    const os = approvedStudents.filter((s) => !ids.has(s.id));
    return { candidates: cs, others: os };
  }, [parentRequest, approvedStudents]);

  const profileId = profile?.id ?? null;
  if (profileId !== lastId) {
    setLastId(profileId);
    setMatchedStudentId("");
    setError(null);
  }

  const handleApprove = () => {
    if (!profile) return;
    setError(null);
    startTransition(async () => {
      const result = await approveProfileAction(
        profile.id,
        profile.role === "parent" ? matchedStudentId || null : null,
      );
      if (result.ok) onClose();
      else setError(result.message);
    });
  };

  const handleReject = () => {
    if (!profile) return;
    setError(null);
    startTransition(async () => {
      const result = await rejectProfileAction(profile.id);
      if (result.ok) onClose();
      else setError(result.message);
    });
  };

  const open = profile !== null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md">
        {profile && (
          <>
            {/* 헤더: 아바타 + 이름 + 메타 */}
            <SheetHeader className="border-b">
              <div className="flex items-start gap-3">
                <Avatar name={profile.full_name} role={profile.role} />
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate text-lg">
                    {profile.full_name}
                  </SheetTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant={profile.role === "student" ? "default" : "primary"}
                    >
                      {profile.role === "student" ? "학생" : "학부모"}
                    </Badge>
                    <Badge variant="warning">승인 대기</Badge>
                  </div>
                  <SheetDescription className="mt-2 text-xs">
                    신청일 {formatDate(profile.created_at)}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="grid auto-rows-min gap-6">
                {/* 기본 정보 */}
                <Section title="기본 정보">
                  <InfoList>
                    <InfoItem
                      icon={<UserCircle2 className="size-4" />}
                      label="이름"
                      value={profile.full_name}
                    />
                    <InfoItem
                      icon={<Phone className="size-4" />}
                      label="휴대폰"
                      value={profile.phone}
                    />
                    {profile.role === "student" && (
                      <>
                        <InfoItem
                          icon={<School className="size-4" />}
                          label="학교"
                          value={profile.school ?? "-"}
                        />
                        <InfoItem
                          icon={<GraduationCap className="size-4" />}
                          label="학년"
                          value={profile.grade ? `${profile.grade}학년` : "-"}
                        />
                      </>
                    )}
                    <InfoItem
                      icon={<Calendar className="size-4" />}
                      label="신청일"
                      value={formatDate(profile.created_at)}
                    />
                  </InfoList>
                </Section>

                {/* 학부모: 자녀 매칭 — 시각적으로 강조 */}
                {profile.role === "parent" && (
                  <Section
                    title="자녀 매칭"
                    description="학부모 승인 시 선택한 학생과 자동으로 연결돼요."
                  >
                    {parentRequest ? (
                      <div className="space-y-3">
                        <div className="border-primary/30 bg-primary/5 rounded-lg border p-3">
                          <p className="text-muted-foreground text-xs font-medium">
                            가입 시 입력된 자녀 정보
                          </p>
                          <div className="mt-1.5 flex items-baseline gap-2">
                            <span className="text-base font-semibold">
                              {parentRequest.student_full_name}
                            </span>
                            <span className="text-muted-foreground text-sm">
                              {parentRequest.student_phone}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="match-student">연결할 학생 *</Label>
                          <Select
                            value={matchedStudentId}
                            onValueChange={setMatchedStudentId}
                            disabled={pending}
                          >
                            <SelectTrigger id="match-student" className="w-full">
                              <SelectValue placeholder="학생을 선택해주세요" />
                            </SelectTrigger>
                            <SelectContent>
                              {candidates.length > 0 && (
                                <SelectGroup>
                                  <SelectLabel>
                                    추천 (이름/전화 일치)
                                  </SelectLabel>
                                  {candidates.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.full_name} · {s.phone}
                                      {s.school ? ` · ${s.school}` : ""}
                                      {s.grade ? ` ${s.grade}학년` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              )}
                              <SelectGroup>
                                <SelectLabel>전체 승인된 학생</SelectLabel>
                                {others.length === 0 ? (
                                  <div className="text-muted-foreground px-2 py-2 text-xs">
                                    (없음)
                                  </div>
                                ) : (
                                  others.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.full_name} · {s.phone}
                                      {s.school ? ` · ${s.school}` : ""}
                                      {s.grade ? ` ${s.grade}학년` : ""}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          {!matchedStudentId && (
                            <p className="text-muted-foreground text-xs">
                              승인 전에 반드시 자녀를 선택해야 해요.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        자녀 정보가 입력되지 않았어요.
                      </p>
                    )}
                  </Section>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            {/* 푸터 */}
            <SheetFooter className="border-t">
              <div className="flex w-full gap-2">
                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={pending}
                  className="flex-1"
                >
                  반려
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={
                    pending ||
                    (profile.role === "parent" && !matchedStudentId)
                  }
                  className="flex-1"
                >
                  {pending ? "처리 중..." : "승인"}
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Avatar({ name, role }: { name: string; role: string }) {
  const initial = name.trim().charAt(0) || "?";
  const isStudent = role === "student";
  return (
    <div
      className={
        "flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold " +
        (isStudent
          ? "bg-secondary text-secondary-foreground"
          : "bg-primary/10 text-primary")
      }
    >
      {initial}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-foreground text-sm font-semibold">{title}</h3>
        {description && (
          <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function InfoList({ children }: { children: React.ReactNode }) {
  return <dl className="divide-y rounded-md border">{children}</dl>;
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
      <dt className="text-muted-foreground inline-flex items-center gap-2">
        {icon}
        {label}
      </dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
