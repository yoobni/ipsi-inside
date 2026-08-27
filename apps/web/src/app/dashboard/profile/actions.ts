"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { CONSENT_DOC_VERSIONS, passwordSchema } from "@ipsi/types";
import { extractClientIp, friendlyDbError } from "@ipsi/lib";
import { z } from "zod";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";

type Result = { ok: true } | { ok: false; message: string };

const studentSchema = z.object({
  full_name: z.string().trim().min(2, "이름을 입력해주세요").max(40),
  phone: z
    .string()
    .trim()
    .regex(/^01[016789][0-9]{7,8}$/, "휴대폰 번호 형식을 확인해주세요"),
  school: z.string().trim().max(40).nullable().optional(),
  grade: z.coerce.number().int().min(1).max(3).nullable().optional(),
});
const parentSchema = z.object({
  full_name: z.string().trim().min(2, "이름을 입력해주세요").max(40),
  phone: z
    .string()
    .trim()
    .regex(/^01[016789][0-9]{7,8}$/, "휴대폰 번호 형식을 확인해주세요"),
});

export async function updateMyProfileAction(
  _prev: Result | null,
  formData: FormData,
): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.status !== "approved") {
    return { ok: false, message: "권한이 없습니다" };
  }

  const phoneRaw = (formData.get("phone") as string) ?? "";
  const phone = phoneRaw.replace(/[^0-9]/g, "");

  if (profile.role === "student") {
    const parsed = studentSchema.safeParse({
      full_name: formData.get("full_name"),
      phone,
      school: (formData.get("school") as string) || null,
      grade: formData.get("grade") || null,
    });
    if (!parsed.success)
      return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        phone: parsed.data.phone,
        school: parsed.data.school?.toString().trim() || null,
        grade: parsed.data.grade ?? null,
      })
      .eq("id", user.id);
    if (error) return { ok: false, message: friendlyDbError(error) };
  } else if (profile.role === "parent") {
    const parsed = parentSchema.safeParse({
      full_name: formData.get("full_name"),
      phone,
    });
    if (!parsed.success)
      return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        phone: parsed.data.phone,
      })
      .eq("id", user.id);
    if (error) return { ok: false, message: friendlyDbError(error) };
  } else {
    return { ok: false, message: "이 페이지는 학생/학부모용입니다" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  return { ok: true };
}

/**
 * 회원 탈퇴 — 비밀번호 재확인 후 PII 마스킹 + status=suspended + signOut.
 * 학습 이력은 student_id FK로 유지(익명 처리), 학부모-자녀 링크는 삭제.
 * 동일 이메일 재가입은 운영자가 admin api로 풀어줘야 가능.
 */
export async function withdrawAction(
  _prev: Result | null,
  formData: FormData,
): Promise<Result> {
  const password = String(formData.get("password") ?? "");
  if (!password) return { ok: false, message: "비밀번호를 입력해주세요" };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email)
    return { ok: false, message: "로그인이 필요합니다" };

  // 비밀번호 재확인 — signInWithPassword 결과로 검증 (성공 시 세션 갱신)
  const { error: signinErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (signinErr) {
    return { ok: false, message: "비밀번호가 일치하지 않습니다" };
  }

  // admin client로 마스킹 (RLS bypass — 사용자가 본인 status 변경 못 하는 정책 대비)
  const admin = createAdminSupabaseClient();

  // 마스킹하면 원래 이름·번호를 잃는다. 다른 테이블에 흩어진 같은 값을 지우려면
  // 지금 붙잡아 둬야 한다 — 아래 parent_signup_requests와 notifications 정리에 쓴다.
  const { data: before } = await admin
    .from("profiles")
    .select("full_name, phone, role")
    .eq("id", user.id)
    .maybeSingle();
  const originalName = before?.full_name?.trim() ?? null;
  const originalPhone = before?.phone?.trim() ?? null;

  // 링크를 지우기 전에 자녀 기록을 받아 본 학부모가 누구였는지 확보한다.
  const { data: linkedParents } = await admin
    .from("parent_student_links")
    .select("parent_id")
    .eq("student_id", user.id);

  const { error: updErr } = await admin
    .from("profiles")
    .update({
      status: "suspended",
      full_name: "(탈퇴회원)",
      phone: "",
      school: null,
      grade: null,
      terms_agreed_at: null,
      privacy_agreed_at: null,
      marketing_agreed_at: null,
    })
    .eq("id", user.id);
  if (updErr) {
    return { ok: false, message: "탈퇴 처리 중 오류가 발생했습니다" };
  }

  // 학생 본인이 작성한 자유서술(학습 일지)은 파기.
  // 텍스트에 PII가 인라인으로 섞일 수 있고, 비워두면 빈 껍데기라 익명 보존 가치가 없음.
  // journal_feedbacks는 journal_id on delete cascade로 함께 삭제됨.
  // 시험 응시 결과·출결 등 정량 학습 이력은 프로필 마스킹으로 익명화되어 그대로 보존됨.
  await admin.from("study_journals").delete().eq("student_id", user.id);

  // 학부모-자녀 링크 정리
  await admin
    .from("parent_student_links")
    .delete()
    .or(`parent_id.eq.${user.id},student_id.eq.${user.id}`);

  // 학부모일 경우 자녀 매칭 요청도 정리
  await admin
    .from("parent_signup_requests")
    .delete()
    .eq("parent_id", user.id);

  // **학생**이 탈퇴하면 이 테이블에 그 학생의 이름·전화가 남는다.
  // 학부모가 가입할 때 자녀로 적어 넣은 값이라 parent_id가 학부모라서
  // 위 delete로는 걸리지 않는다. 행 자체를 지우면 학부모 계정의 매칭
  // 근거가 사라지므로 자녀 식별 정보만 지운다 — 처리방침 §6의
  // "이름·휴대폰 번호 즉시 파기"가 가리키는 대상이다.
  if (before?.role === "student") {
    const masked = { student_full_name: "(탈퇴회원)", student_phone: "" };
    // 승인되어 매칭이 끝난 행
    await admin
      .from("parent_signup_requests")
      .update(masked)
      .eq("matched_student_id", user.id);
    // 아직 매칭 전인 행은 연결고리가 없다. 전화번호가 유일한 단서다.
    if (originalPhone) {
      await admin
        .from("parent_signup_requests")
        .update(masked)
        .is("matched_student_id", null)
        .eq("student_phone", originalPhone);
    }
  }

  // 플래너 인증사진은 학생의 얼굴·필기가 담긴 개인정보다. 탈퇴 후에도 스토리지에
  // 남아 있었다 — 프로필을 마스킹해도 사진은 익명화되지 않는다.
  // 경로 규칙은 `{user.id}/{uuid}.{ext}` (upload-proof.ts)라 폴더째 지운다.
  const { data: proofs } = await admin.storage
    .from("planner-proofs")
    .list(user.id, { limit: 1000 });
  if (proofs && proofs.length > 0) {
    await admin.storage
      .from("planner-proofs")
      .remove(proofs.map((f) => `${user.id}/${f.name}`));
  }

  // 체크 행 자체(정량 이력)는 익명 보존하되, 자유서술과 사진 참조는 지운다 —
  // study_journals를 파기하는 것과 같은 이유다.
  await admin
    .from("planner_task_checks")
    .update({ late_reason: null, photo_path: null })
    .eq("student_id", user.id);

  // Q&A 질문(자유서술)과 첨부 사진 파기 — 플래너 인증사진과 같은 기준.
  // 질문 행은 개인 식별 서술이라 통째로 지운다(답변도 cascade). 사진은 폴더째.
  await admin.from("qna_questions").delete().eq("student_id", user.id);
  const { data: qnaImgs } = await admin.storage
    .from("qna-images")
    .list(user.id, { limit: 1000 });
  if (qnaImgs && qnaImgs.length > 0) {
    await admin.storage
      .from("qna-images")
      .remove(qnaImgs.map((f) => `${user.id}/${f.name}`));
  }

  // 동의 이력 파기 — profiles의 동의 시각 컬럼을 null로 지우는 것과 같은 기준.
  // 처리방침에 고지한 보유기간이 "회원 탈퇴 시까지"다.
  await admin.from("consent_records").delete().eq("user_id", user.id);

  // 알림에 이름이 박혀 있다. 본인 알림은 통째로,
  // 남의 알림함에 들어간 것은 실명이 든 행만 지운다:
  //   - 학부모: "{이름} 학생의 주간 플래너가 배정됐어요" (admin/planner/actions.ts)
  //   - 원장:   "{이름} 일지 제출", "{이름} 시험 제출"
  // 이 행들은 **받는 사람 소유**라 프로필을 마스킹해도 그대로 남는다.
  await admin.from("notifications").delete().eq("user_id", user.id);

  if (originalName) {
    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin");
    const recipients = [
      ...(linkedParents ?? []).map((l) => l.parent_id),
      ...(admins ?? []).map((a) => a.id),
    ];
    if (recipients.length > 0) {
      // like 와일드카드가 이름에 섞여 들어가지 않게 이스케이프한다.
      const pattern = `%${originalName.replace(/[\\%_]/g, "\\$&")}%`;
      // 동명이인이 있으면 그 학생의 알림도 함께 지워진다. 알림은 다시 만들 수
      // 없는 기록이 아니고, 이름을 남겨두는 쪽이 더 큰 문제라 이렇게 둔다.
      await admin
        .from("notifications")
        .delete()
        .in("user_id", recipients)
        .ilike("title", pattern);
    }
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?withdrawn=1");
}

/**
 * 비밀번호 변경.
 *
 * 원장이 임시 비밀번호를 발급하면 profiles.must_change_password가 켜지고,
 * 학생이 여기서 새로 정할 때까지 다른 화면이 막힌다(proxy.ts). 원장이 아는
 * 비밀번호가 계정에 남아 있지 않게 하려는 것.
 */
export async function changeMyPasswordAction(
  _prev: Result | null,
  formData: FormData,
): Promise<Result> {
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (!current) return { ok: false, message: "지금 쓰는 비밀번호를 입력해주세요" };
  const parsedNext = passwordSchema.safeParse(next);
  if (!parsedNext.success) {
    return {
      ok: false,
      message: parsedNext.error.issues[0]?.message ?? "비밀번호를 확인해주세요",
    };
  }
  if (next !== confirm) {
    return { ok: false, message: "새 비밀번호가 서로 달라요" };
  }
  if (next === current) {
    return { ok: false, message: "지금 쓰는 비밀번호와 다르게 정해주세요" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, message: "로그인이 필요합니다" };

  // 현재 비밀번호 확인 — 세션만 믿으면 남이 켜둔 브라우저에서 바꿀 수 있다
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (signInError) {
    return { ok: false, message: "지금 쓰는 비밀번호가 맞지 않아요" };
  }

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { ok: false, message: error.message };

  // 임시 비밀번호 잠금 해제.
  // profiles는 본인이 이름·연락처·학교·학년만 쓸 수 있게 컬럼 권한을 좁혔다
  // (보안조사 H-2 — 안 그러면 학생이 이 잠금을 스스로 풀 수 있다).
  // 여기는 현재 비밀번호 확인을 이미 통과한 지점이라 service_role로 쓴다.
  const { error: flagError } = await createAdminSupabaseClient()
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);
  if (flagError) return { ok: false, message: friendlyDbError(flagError) };

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * 광고성 정보 수신 동의 설정·철회.
 *
 * 처리방침이 "[내 정보]에서 언제든 철회할 수 있다"고 약속하는 항목이라
 * 실제로 동작해야 한다. 없으면 처리방침이 거짓 기재가 된다.
 *
 * 동의/철회 둘 다 consent_records에 행을 쌓는다 — 이력이 남지 않으면
 * "언제 껐는지" 다툼이 생겼을 때 확인할 방법이 없다. 그 테이블은 insert
 * 정책이 없어서(클라이언트 위조 방지) service_role로 쓴다.
 */
export async function setMarketingConsentAction(
  _prev: Result | null,
  formData: FormData,
): Promise<Result> {
  const agreed = formData.get("agreed") === "on";

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다" };

  // 동의 시각도 본인이 직접 못 쓴다(H-2와 같은 이유 — 증적이 조작되면 안 된다).
  // 사용자의 선택은 여기서 받고, 기록은 서버가 남긴다.
  const { error } = await createAdminSupabaseClient()
    .from("profiles")
    .update({ marketing_agreed_at: agreed ? new Date().toISOString() : null })
    .eq("id", user.id);
  if (error) return { ok: false, message: friendlyDbError(error) };

  const h = await headers();
  const ip = extractClientIp(h);
  const { error: recordError } = await createAdminSupabaseClient()
    .from("consent_records")
    .insert({
      user_id: user.id,
      kind: "marketing",
      doc_version: CONSENT_DOC_VERSIONS.marketing,
      agreed,
      ip: ip && ip.length > 0 ? ip : null,
      user_agent: h.get("user-agent"),
    });
  // 이력 저장 실패로 설정 자체를 되돌리진 않는다 — 사용자가 끈 건 이미 반영됐다
  if (recordError) {
    console.error("[consent] 마케팅 동의 이력 저장 실패", {
      userId: user.id,
      recordError,
    });
  }

  revalidatePath("/dashboard/profile");
  return { ok: true };
}
