"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

export function PendingList({
  profiles,
  parentRequests,
  approvedStudents,
}: {
  profiles: PendingProfile[];
  parentRequests: ParentRequest[];
  approvedStudents: ApprovedStudent[];
}) {
  if (profiles.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        대기 중인 가입 신청이 없습니다.
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {profiles.map((p) => (
        <PendingRow
          key={p.id}
          profile={p}
          parentRequest={
            p.role === "parent"
              ? parentRequests.find((r) => r.parent_id === p.id)
              : undefined
          }
          approvedStudents={approvedStudents}
        />
      ))}
    </ul>
  );
}

function PendingRow({
  profile,
  parentRequest,
  approvedStudents,
}: {
  profile: PendingProfile;
  parentRequest?: ParentRequest;
  approvedStudents: ApprovedStudent[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [matchedStudentId, setMatchedStudentId] = useState<string>("");

  // 학부모인 경우, 자녀 매칭 후보를 자동 추천 (이름 또는 전화번호 일치)
  const candidates = parentRequest
    ? approvedStudents.filter(
        (s) =>
          s.full_name === parentRequest.student_full_name ||
          s.phone === parentRequest.student_phone,
      )
    : [];

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const result = await approveProfileAction(
        profile.id,
        profile.role === "parent" ? matchedStudentId || null : null,
      );
      if (!result.ok) setError(result.message);
    });
  };

  const handleReject = () => {
    setError(null);
    startTransition(async () => {
      const result = await rejectProfileAction(profile.id);
      if (!result.ok) setError(result.message);
    });
  };

  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
              {profile.role === "student" ? "학생" : "학부모"}
            </span>
            <span className="font-medium">{profile.full_name}</span>
            <span className="text-sm text-muted-foreground">{profile.phone}</span>
          </div>
          {profile.role === "student" && (
            <p className="mt-1 text-sm text-muted-foreground">
              {profile.school} {profile.grade ? `${profile.grade}학년` : ""}
            </p>
          )}
          {profile.role === "parent" && parentRequest && (
            <div className="mt-2 rounded-md bg-muted/50 p-3 text-sm">
              <p className="text-muted-foreground">
                자녀 정보 (가입 시 입력):{" "}
                <span className="font-medium text-foreground">
                  {parentRequest.student_full_name}
                </span>{" "}
                / {parentRequest.student_phone}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <label htmlFor={`match-${profile.id}`} className="text-xs">
                  연결할 학생:
                </label>
                <select
                  id={`match-${profile.id}`}
                  value={matchedStudentId}
                  onChange={(e) => setMatchedStudentId(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                  disabled={pending}
                >
                  <option value="">선택 안 함</option>
                  {candidates.length > 0 && (
                    <optgroup label="추천 (이름/전화 일치)">
                      {candidates.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} · {s.phone} · {s.school}{" "}
                          {s.grade ? `${s.grade}학년` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="전체 승인된 학생">
                    {approvedStudents
                      .filter((s) => !candidates.includes(s))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} · {s.phone} · {s.school}{" "}
                          {s.grade ? `${s.grade}학년` : ""}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            신청일: {new Date(profile.created_at).toLocaleString("ko-KR")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReject}
            disabled={pending}
          >
            반려
          </Button>
          <Button size="sm" onClick={handleApprove} disabled={pending}>
            {pending ? "처리 중..." : "승인"}
          </Button>
        </div>
      </div>
      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </li>
  );
}
