"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import {
  SCOPE_MODE,
  SCOPE_MODE_LABEL,
  STAFF_PERMISSIONS,
  STAFF_PERMISSION_HINT,
  STAFF_PERMISSION_LABEL,
  type PermissionKey,
  type ScopeMode,
} from "@ipsi/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStaffAction, updateStaffAction } from "./actions";

export type StudentChoice = {
  id: string;
  full_name: string;
  school: string | null;
  grade: number | null;
};
export type GroupChoice = { id: string; name: string; archived: boolean };

export type StaffFormInitial = {
  fullName: string;
  phone: string;
  email: string;
  permissions: PermissionKey[];
  scopeMode: ScopeMode;
  studentIds: string[];
  groupIds: string[];
};

const EMPTY: StaffFormInitial = {
  fullName: "",
  phone: "",
  email: "",
  permissions: [],
  scopeMode: "scoped",
  studentIds: [],
  groupIds: [],
};

/**
 * 조교 등록/편집 폼. 권한 체크박스 + 범위(전체/지정) + 학생·그룹 다중선택.
 * 등록이 끝나면 임시 비밀번호를 **이 화면에서 한 번만** 보여준다.
 */
export function StaffForm({
  staffId,
  initial = EMPTY,
  students,
  groups,
}: {
  /** 있으면 편집, 없으면 등록 */
  staffId?: string;
  initial?: StaffFormInitial;
  students: StudentChoice[];
  groups: GroupChoice[];
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.fullName);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(
    new Set(initial.permissions),
  );
  const [scopeMode, setScopeMode] = useState<ScopeMode>(initial.scopeMode);
  const [studentIds, setStudentIds] = useState<Set<string>>(new Set(initial.studentIds));
  const [groupIds, setGroupIds] = useState<Set<string>>(new Set(initial.groupIds));
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ id: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const filteredStudents = useMemo(() => {
    const q = query.trim();
    if (!q) return students;
    return students.filter(
      (s) => s.full_name.includes(q) || (s.school ?? "").includes(q),
    );
  }, [students, query]);

  const toggle = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setter(next);
  };

  const save = () => {
    setError(null);
    const payload = {
      fullName,
      phone,
      permissions: [...permissions],
      scopeMode,
      studentIds: scopeMode === "scoped" ? [...studentIds] : [],
      groupIds: scopeMode === "scoped" ? [...groupIds] : [],
    };
    startTransition(async () => {
      if (staffId) {
        const res = await updateStaffAction(staffId, payload);
        if (!res.ok) {
          setError(res.message);
          return;
        }
        router.push("/staff");
        router.refresh();
      } else {
        const res = await createStaffAction({ ...payload, email });
        if (!res.ok) {
          setError(res.message);
          return;
        }
        setIssued({ id: res.id, tempPassword: res.tempPassword });
      }
    });
  };

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.tempPassword);
      setCopied(true);
    } catch {
      setError("복사가 막혀 있어요. 직접 선택해 복사해주세요.");
    }
  };

  if (issued) {
    return (
      <Alert>
        <AlertDescription className="space-y-3">
          <p className="text-sm">
            <b>{fullName}</b> 조교 계정을 만들었어요. 아래 임시 비밀번호는{" "}
            <b>이 화면에서만 볼 수 있어요</b> — 전달한 뒤 창을 닫으세요.
          </p>
          <div className="flex items-center gap-2">
            <code className="bg-background rounded-md border px-2.5 py-1.5 text-base font-bold tracking-wider">
              {issued.tempPassword}
            </code>
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? (
                <>
                  <Check className="size-3.5" /> 복사됨
                </>
              ) : (
                <>
                  <Copy className="size-3.5" /> 복사
                </>
              )}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            조교가 {email} 로 로그인하면 새 비밀번호를 정하는 화면이 먼저 떠요. 바꾸기
            전에는 다른 화면을 쓸 수 없어요.
          </p>
          <div className="flex gap-2 pt-1">
            <Button asChild variant="outline" size="sm">
              <Link href="/staff">목록으로</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/staff/${issued.id}`}>이 조교 설정 보기</Link>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-4 rounded-md border bg-card p-5">
        <h2 className="font-bold">계정</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="staff-name">이름</Label>
            <Input
              id="staff-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={20}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-phone">휴대폰</Label>
            <Input
              id="staff-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="staff-email">로그인 이메일</Label>
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={Boolean(staffId)}
              placeholder="assistant@example.com"
            />
            {!staffId && (
              <p className="text-muted-foreground text-xs">
                임시 비밀번호가 발급돼요. 조교는 첫 로그인에서 비밀번호를 새로 정해야 해요.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-md border bg-card p-5">
        <div>
          <h2 className="font-bold">열 수 있는 메뉴</h2>
          <p className="text-muted-foreground text-xs">
            체크한 메뉴만 사이드바에 보이고 들어갈 수 있어요.
          </p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {STAFF_PERMISSIONS.map((p) => (
            <li key={p}>
              <label className="hover:bg-muted/50 flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={permissions.has(p)}
                  onChange={() => toggle(permissions, p, setPermissions)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{STAFF_PERMISSION_LABEL[p]}</span>
                  <span className="text-muted-foreground block text-xs">
                    {STAFF_PERMISSION_HINT[p]}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-md border bg-card p-5">
        <div>
          <h2 className="font-bold">담당 학생 범위</h2>
          <p className="text-muted-foreground text-xs">
            일일 마킹·플래너·일지·시험·Q&amp;A·회원 열람에서 이 범위의 학생(과 연결된
            학부모)만 보여요. 공지·칼럼·자료는 메뉴 권한만으로 전체에게 나가요.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          {SCOPE_MODE.map((m) => (
            <label key={m} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="scope-mode"
                checked={scopeMode === m}
                onChange={() => setScopeMode(m)}
              />
              {SCOPE_MODE_LABEL[m]}
            </label>
          ))}
        </div>

        {scopeMode === "scoped" && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>담당 그룹</Label>
                <span className="text-muted-foreground text-xs">{groupIds.size}개</span>
              </div>
              {groups.length === 0 ? (
                <p className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center text-sm">
                  만들어진 그룹이 없어요.
                </p>
              ) : (
                <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                  {groups.map((g) => (
                    <li key={g.id}>
                      <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={groupIds.has(g.id)}
                          onChange={() => toggle(groupIds, g.id, setGroupIds)}
                        />
                        <span className={g.archived ? "text-muted-foreground line-through" : ""}>
                          {g.name}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-muted-foreground text-xs">
                그룹 멤버는 바뀌면 자동 반영돼요(동적).
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>담당 학생 (개별 지정)</Label>
                <span className="text-muted-foreground text-xs">{studentIds.size}명</span>
              </div>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름·학교로 찾기"
              />
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                {filteredStudents.length === 0 ? (
                  <li className="text-muted-foreground px-2 py-4 text-center text-sm">
                    해당하는 학생이 없어요.
                  </li>
                ) : (
                  filteredStudents.map((s) => (
                    <li key={s.id}>
                      <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={studentIds.has(s.id)}
                          onChange={() => toggle(studentIds, s.id, setStudentIds)}
                        />
                        <span className="font-medium">{s.full_name}</span>
                        <span className="text-muted-foreground text-xs">
                          {s.school ?? ""}
                          {s.grade ? ` ${s.grade}학년` : ""}
                        </span>
                      </label>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        )}
        {scopeMode === "scoped" && studentIds.size === 0 && groupIds.size === 0 && (
          <p className="text-destructive text-xs">
            지정한 학생·그룹이 없으면 이 조교는 학생 데이터를 아무것도 볼 수 없어요.
          </p>
        )}
      </section>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" size="lg">
          <Link href="/staff">취소</Link>
        </Button>
        <Button size="lg" onClick={save} disabled={pending}>
          {pending ? "저장 중..." : staffId ? "저장" : "조교 만들기"}
        </Button>
      </div>
    </div>
  );
}
