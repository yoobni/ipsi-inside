"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Calendar,
  GraduationCap,
  Phone,
  Plus,
  Search,
  School,
  Trash2,
  UserCircle2,
  Users,
} from "lucide-react";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addParentStudentLinkAction,
  removeParentStudentLinkAction,
  suspendMemberAction,
  unsuspendMemberAction,
} from "./actions";

type Member = {
  id: string;
  role: string;
  status: string;
  full_name: string;
  phone: string;
  school: string | null;
  grade: number | null;
  created_at: string;
  approved_at: string | null;
};

type Link = { parent_id: string; student_id: string };

type Student = {
  id: string;
  role: string;
  status: string;
  full_name: string;
  phone: string;
  school: string | null;
  grade: number | null;
};

type TabValue = "all" | "student" | "parent";

export function MembersTable({
  members,
  links,
  approvedStudents,
}: {
  members: Member[];
  links: Link[];
  approvedStudents: Student[];
}) {
  const [tab, setTab] = useState<TabValue>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);

  const linkCountByParent = useMemo(() => {
    const m = new Map<string, number>();
    links.forEach((l) => m.set(l.parent_id, (m.get(l.parent_id) ?? 0) + 1));
    return m;
  }, [links]);

  const studentCount = members.filter((m) => m.role === "student").length;
  const parentCount = members.filter((m) => m.role === "parent").length;

  const filtered = useMemo(() => {
    const q = query.trim();
    return members.filter((m) => {
      if (tab !== "all" && m.role !== tab) return false;
      if (!q) return true;
      return m.full_name.includes(q) || m.phone.includes(q);
    });
  }, [members, tab, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
          <TabsList>
            <TabsTrigger value="all">전체 {members.length}</TabsTrigger>
            <TabsTrigger value="student">학생 {studentCount}</TabsTrigger>
            <TabsTrigger value="parent">학부모 {parentCount}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            type="search"
            placeholder="이름/전화 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[88px] pl-4">유형</TableHead>
              <TableHead>이름</TableHead>
              <TableHead>연락처</TableHead>
              <TableHead>소속 / 연결</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="pr-4 text-right">가입일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground h-24 text-center"
                >
                  {query
                    ? `"${query}" 검색 결과가 없습니다.`
                    : "회원이 없습니다."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => (
                <TableRow
                  key={m.id}
                  data-state={selected?.id === m.id ? "selected" : undefined}
                  className="cursor-pointer"
                  onClick={() => setSelected(m)}
                >
                  <TableCell className="pl-4">
                    <Badge variant={m.role === "student" ? "default" : "primary"}>
                      {m.role === "student" ? "학생" : "학부모"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{m.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.phone}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.role === "student"
                      ? `${m.school ?? "-"}${m.grade ? ` · ${m.grade}학년` : ""}`
                      : `자녀 ${linkCountByParent.get(m.id) ?? 0}명`}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={m.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground pr-4 text-right">
                    {formatDate(m.created_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <MemberDrawer
        member={selected}
        links={links}
        approvedStudents={approvedStudents}
        allMembers={members}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge variant="success">활성</Badge>;
  if (status === "suspended") return <Badge variant="warning">정지</Badge>;
  if (status === "rejected") return <Badge variant="outline">반려</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function MemberDrawer({
  member,
  links,
  approvedStudents,
  allMembers,
  onClose,
}: {
  member: Member | null;
  links: Link[];
  approvedStudents: Student[];
  allMembers: Member[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addStudentId, setAddStudentId] = useState<string>("");
  const [lastId, setLastId] = useState<string | null>(null);

  const memberId = member?.id ?? null;
  if (memberId !== lastId) {
    setLastId(memberId);
    setAddStudentId("");
    setError(null);
  }

  const linkedStudents = useMemo(() => {
    if (!member || member.role !== "parent") return [];
    const studentIds = new Set(
      links.filter((l) => l.parent_id === member.id).map((l) => l.student_id),
    );
    return allMembers.filter((m) => studentIds.has(m.id));
  }, [member, links, allMembers]);

  const availableStudents = useMemo(() => {
    if (!member || member.role !== "parent") return [];
    const linkedIds = new Set(linkedStudents.map((s) => s.id));
    return approvedStudents.filter((s) => !linkedIds.has(s.id));
  }, [member, linkedStudents, approvedStudents]);

  const run = (
    fn: () => Promise<{ ok: true } | { ok: false; message: string }>,
  ) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message);
    });
  };

  const open = member !== null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md">
        {member && (
          <>
            <SheetHeader className="border-b">
              <div className="flex items-start gap-3">
                <Avatar name={member.full_name} role={member.role} />
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate text-lg">
                    {member.full_name}
                  </SheetTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant={member.role === "student" ? "default" : "primary"}
                    >
                      {member.role === "student" ? "학생" : "학부모"}
                    </Badge>
                    <StatusBadge status={member.status} />
                  </div>
                  <SheetDescription className="mt-2 text-xs">
                    가입 {formatDate(member.created_at)}
                    {member.approved_at &&
                      ` · 승인 ${formatDate(member.approved_at)}`}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="grid auto-rows-min gap-6">
                <Section title="기본 정보">
                  <InfoList>
                    <InfoItem
                      icon={<UserCircle2 className="size-4" />}
                      label="이름"
                      value={member.full_name}
                    />
                    <InfoItem
                      icon={<Phone className="size-4" />}
                      label="휴대폰"
                      value={member.phone}
                    />
                    {member.role === "student" && (
                      <>
                        <InfoItem
                          icon={<School className="size-4" />}
                          label="학교"
                          value={member.school ?? "-"}
                        />
                        <InfoItem
                          icon={<GraduationCap className="size-4" />}
                          label="학년"
                          value={member.grade ? `${member.grade}학년` : "-"}
                        />
                      </>
                    )}
                    <InfoItem
                      icon={<Calendar className="size-4" />}
                      label="가입일"
                      value={formatDate(member.created_at)}
                    />
                  </InfoList>
                </Section>

                {member.role === "parent" && (
                  <Section
                    title="자녀 연결"
                    description="이 학부모와 연결된 학생을 추가하거나 해제해요."
                  >
                    <div className="space-y-3">
                      {linkedStudents.length === 0 ? (
                        <p className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center text-sm">
                          연결된 자녀가 없어요.
                        </p>
                      ) : (
                        <ul className="divide-y rounded-md border">
                          {linkedStudents.map((s) => (
                            <li
                              key={s.id}
                              className="flex items-center justify-between gap-2 px-3 py-2.5"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {s.full_name}
                                </p>
                                <p className="text-muted-foreground truncate text-xs">
                                  {s.phone}
                                  {s.school ? ` · ${s.school}` : ""}
                                  {s.grade ? ` · ${s.grade}학년` : ""}
                                </p>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                disabled={pending}
                                onClick={() =>
                                  run(() =>
                                    removeParentStudentLinkAction(
                                      member.id,
                                      s.id,
                                    ),
                                  )
                                }
                                aria-label="연결 해제"
                                className="size-8"
                              >
                                <Trash2 className="text-destructive size-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="add-student">자녀 추가</Label>
                        <div className="flex gap-2">
                          <Select
                            value={addStudentId}
                            onValueChange={setAddStudentId}
                            disabled={pending || availableStudents.length === 0}
                          >
                            <SelectTrigger id="add-student" className="flex-1">
                              <SelectValue
                                placeholder={
                                  availableStudents.length === 0
                                    ? "추가할 학생이 없어요"
                                    : "학생을 선택하세요"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {availableStudents.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.full_name} · {s.phone}
                                  {s.school ? ` · ${s.school}` : ""}
                                  {s.grade ? ` ${s.grade}학년` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            disabled={pending || !addStudentId}
                            onClick={() => {
                              const sid = addStudentId;
                              setAddStudentId("");
                              run(() =>
                                addParentStudentLinkAction(member.id, sid),
                              );
                            }}
                          >
                            <Plus className="size-4" />
                            추가
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Section>
                )}

                {member.role === "student" && (
                  <Section title="연결된 학부모">
                    <StudentParentList
                      studentId={member.id}
                      links={links}
                      allMembers={allMembers}
                    />
                  </Section>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <SheetFooter className="border-t">
              <div className="flex w-full gap-2">
                {member.status === "suspended" ? (
                  <Button
                    onClick={() => run(() => unsuspendMemberAction(member.id))}
                    disabled={pending}
                    className="flex-1"
                  >
                    {pending ? "처리 중..." : "정지 해제"}
                  </Button>
                ) : member.status === "approved" ? (
                  <Button
                    variant="outline"
                    onClick={() => run(() => suspendMemberAction(member.id))}
                    disabled={pending}
                    className="flex-1"
                  >
                    {pending ? "처리 중..." : "계정 정지"}
                  </Button>
                ) : (
                  <Button disabled className="flex-1">
                    조치 없음 (반려)
                  </Button>
                )}
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StudentParentList({
  studentId,
  links,
  allMembers,
}: {
  studentId: string;
  links: Link[];
  allMembers: Member[];
}) {
  const parents = useMemo(() => {
    const parentIds = new Set(
      links.filter((l) => l.student_id === studentId).map((l) => l.parent_id),
    );
    return allMembers.filter((m) => parentIds.has(m.id));
  }, [studentId, links, allMembers]);

  if (parents.length === 0) {
    return (
      <p className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
        <Users className="size-4" />
        연결된 학부모가 없어요.
      </p>
    );
  }
  return (
    <ul className="divide-y rounded-md border">
      {parents.map((p) => (
        <li key={p.id} className="px-3 py-2.5 text-sm">
          <p className="font-medium">{p.full_name}</p>
          <p className="text-muted-foreground text-xs">{p.phone}</p>
        </li>
      ))}
    </ul>
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
