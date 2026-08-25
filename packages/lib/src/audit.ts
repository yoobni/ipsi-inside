import { createAdminSupabaseClient } from './supabase/admin';
import { extractClientIp } from './rate-limit';

/**
 * 개인정보 접속기록 — 「개인정보의 안전성 확보조치 기준」 고시 제8조.
 *
 * 개인정보취급자(원장)가 언제 누구의 무엇에 닿았는지 남긴다. 최소 1년 보관하고
 * 월 1회 이상 점검해야 하는 그 기록이다. 유출 사고가 났을 때 이게 없으면
 * 범위를 특정하는 조사 자체가 불가능하다.
 *
 * 쓰기는 service_role로만 한다 — admin_access_logs에는 insert 정책이 없다.
 * 기록 주체가 제 기록을 고칠 수 있으면 증적이 아니다(consent_records와 같은 논리).
 *
 * **실패해도 본 작업을 되돌리지 않는다.** 조회가 이미 일어난 뒤에 로그만 실패한
 * 것이라 되돌릴 대상이 없고, 로깅 장애로 원장이 일을 못 하게 되는 편이 더 나쁘다.
 * 대신 서버 로그에 남겨 사후에 메울 수 있게 한다.
 */
export type AdminAccessAction =
  | 'member.view' // 회원 상세(이름·연락처·학교) 열람
  | 'member.approve'
  | 'member.reject'
  | 'attendance.export' // 일일 마킹 CSV — 이름·학교·학년 포함
  | 'test.export' // 시험 결과 CSV — 이름 포함
  | 'password.issue' // 임시 비밀번호 발급
  // 원장이 admin에서 인증사진을 보는 화면은 아직 없다(web의 학생·학부모
  // 열람 라우트뿐). 그 화면이 생기면 이 값을 쓴다.
  | 'proof.view'
  // 접속기록을 점검했다는 사실 자체 — 고시는 보관과 점검을 둘 다 요구한다.
  | 'audit.review';

export type AdminAccessLogInput = {
  actorId: string;
  action: AdminAccessAction;
  targetType?: string | null;
  targetId?: string | null;
  /** 범위형 반출처럼 targetId로 표현 못 하는 맥락 (기간, 건수 등) */
  detail?: Record<string, unknown> | null;
  headers?: Headers;
};

export async function logAdminAccess(input: AdminAccessLogInput): Promise<void> {
  try {
    const ip = input.headers ? extractClientIp(input.headers) : null;
    const { error } = await createAdminSupabaseClient()
      .from('admin_access_logs')
      .insert({
        actor_id: input.actorId,
        action: input.action,
        target_type: input.targetType ?? null,
        target_id: input.targetId ?? null,
        detail: (input.detail ?? null) as never,
        // extractClientIp이 못 찾으면 'unknown'을 준다 — inet 컬럼에 넣으면 터진다
        ip: ip && ip !== 'unknown' ? ip : null,
        user_agent: input.headers?.get('user-agent') ?? null,
      });
    if (error) {
      console.error('[audit] 접속기록 저장 실패', {
        action: input.action,
        actorId: input.actorId,
        error,
      });
    }
  } catch (e) {
    console.error('[audit] 접속기록 예외', { action: input.action, e });
  }
}
