import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";
import { riskFlagsSchema } from "@ipsi/types";
import { todayKst } from "@/lib/kst";

export const dynamic = "force-dynamic";

const NOTIF_TYPE = "risk_detected";

/**
 * 관리 필요 감지 일별 스냅샷 + 새로 뜬 학생 알림.
 *
 * Vercel Cron이 KST 06:00(= UTC 21:00 전날)에 호출 — apps/admin/vercel.json.
 * 어제 스냅샷에 없던 (학생, 규칙)만 알림을 보낸다 — 매일 같은 학생을 반복 알리지 않기 위해.
 * 수신자: 원장 전원 + 그 학생이 담당 범위에 드는 조교(scope all / 직접 지정 / 그룹).
 *
 * 인증: CRON_SECRET Bearer. proxy ALLOW_THROUGH에 /api/cron.
 * 알림 제목에 학생 실명이 들어간다 — 탈퇴 시 파기 대상(플래너 알림과 같은 규칙).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, message: "CRON_SECRET 미설정" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const db = createAdminSupabaseClient();
  const today = todayKst();
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yIso = yesterday.toISOString().slice(0, 10);

  // service_role 호출 — 함수가 전체 학생을 평가한다(ack 포함: 스냅샷은 사실 기록)
  const { data, error } = await db.rpc("student_risk_flags", { p_student_ids: null, p_include_acked: true });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  const parsed = riskFlagsSchema.safeParse(data);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "형태 불일치" }, { status: 500 });
  const flagged = parsed.data;

  // 스냅샷 저장(오늘 것은 덮어씀)
  if (flagged.length > 0) {
    const { error: snapErr } = await db.from("risk_snapshots").upsert(
      flagged.map((s) => ({ snapshot_date: today, student_id: s.student_id, flags: s.flags })),
      { onConflict: "snapshot_date,student_id" },
    );
    if (snapErr) return NextResponse.json({ ok: false, message: snapErr.message }, { status: 500 });
  }

  // 어제 스냅샷과 비교 → 새로 뜬 (학생, 규칙)
  const { data: prev } = await db
    .from("risk_snapshots")
    .select("student_id, flags")
    .eq("snapshot_date", yIso);
  const prevKeys = new Set<string>();
  (prev ?? []).forEach((p) => {
    const flags = riskFlagsSchema.element.shape.flags.safeParse(p.flags);
    if (flags.success) flags.data.forEach((f) => prevKeys.add(`${p.student_id}:${f.key}`));
  });
  const fresh = flagged
    .map((s) => ({ ...s, flags: s.flags.filter((f) => !prevKeys.has(`${s.student_id}:${f.key}`)) }))
    .filter((s) => s.flags.length > 0);

  let sent = 0;
  if (fresh.length > 0) {
    // 수신자: 원장 + 범위에 드는 조교
    const [{ data: owners }, { data: settings }, { data: sScope }, { data: gScope }, { data: members }] =
      await Promise.all([
        db.from("profiles").select("id").eq("role", "admin").eq("admin_level", "owner").eq("status", "approved"),
        db.from("staff_settings").select("staff_id, scope_mode").in("staff_id",
          (await db.from("profiles").select("id").eq("role", "admin").eq("admin_level", "assistant").eq("status", "approved")).data?.map((p) => p.id) ?? []),
        db.from("staff_student_scope").select("staff_id, student_id"),
        db.from("staff_group_scope").select("staff_id, group_id"),
        db.from("group_members").select("group_id, student_id"),
      ]);
    const ownerIds = (owners ?? []).map((o) => o.id);
    const allScopeStaff = (settings ?? []).filter((s) => s.scope_mode === "all").map((s) => s.staff_id);
    const scopedStaff = (settings ?? []).filter((s) => s.scope_mode === "scoped").map((s) => s.staff_id);
    const directByStudent = new Map<string, Set<string>>();
    (sScope ?? []).forEach((r) => {
      if (!scopedStaff.includes(r.staff_id)) return;
      directByStudent.set(r.student_id, (directByStudent.get(r.student_id) ?? new Set()).add(r.staff_id));
    });
    const staffByGroup = new Map<string, string[]>();
    (gScope ?? []).forEach((r) => {
      if (!scopedStaff.includes(r.staff_id)) return;
      staffByGroup.set(r.group_id, [...(staffByGroup.get(r.group_id) ?? []), r.staff_id]);
    });
    const groupsByStudent = new Map<string, string[]>();
    (members ?? []).forEach((m) => groupsByStudent.set(m.student_id, [...(groupsByStudent.get(m.student_id) ?? []), m.group_id]));

    const nowIso = new Date().toISOString();
    const rows = fresh.flatMap((s) => {
      const recipients = new Set<string>([...ownerIds, ...allScopeStaff, ...(directByStudent.get(s.student_id) ?? [])]);
      (groupsByStudent.get(s.student_id) ?? []).forEach((g) => (staffByGroup.get(g) ?? []).forEach((st) => recipients.add(st)));
      const body = s.flags.map((f) => `${f.label}(${f.detail})`).join(" · ");
      return [...recipients].map((user_id) => ({
        user_id,
        type: NOTIF_TYPE,
        title: `⚠ 관리 필요: ${s.full_name}`,
        body,
        link: `/members/${s.student_id}`,
        created_at: nowIso,
      }));
    });
    if (rows.length > 0) {
      const { error: nErr } = await db.from("notifications").insert(rows);
      if (nErr) return NextResponse.json({ ok: false, message: nErr.message }, { status: 500 });
      sent = rows.length;
    }
  }

  return NextResponse.json({ ok: true, today, flagged: flagged.length, fresh: fresh.length, sent });
}
