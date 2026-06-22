/**
 * Supabase/Postgres raw 에러 메시지를 사용자 친화적인 한국어로 변환.
 * 알려진 패턴이 없으면 원문을 fallback으로 반환.
 */
export function friendlyDbError(
  err: { message?: string; code?: string; details?: string } | unknown,
  fallback = "처리 중 오류가 발생했어요.",
): string {
  if (!err || typeof err !== "object") return fallback;
  const e = err as { message?: string; code?: string; details?: string };
  const msg = e.message ?? "";
  const code = e.code ?? "";

  // Postgres SQLSTATE
  if (code === "23505") return "이미 같은 항목이 존재해요.";
  if (code === "23503") return "연결된 데이터가 있어 처리할 수 없어요.";
  if (code === "23502") return "필수 항목이 누락됐어요.";
  if (code === "23514") return "입력값이 허용 범위를 벗어났어요.";
  if (code === "42501" || code === "PGRST301")
    return "권한이 없어요. 다시 로그인해보세요.";

  // 메시지 패턴 fallback
  if (/duplicate key|unique constraint/i.test(msg))
    return "이미 같은 항목이 존재해요.";
  if (/foreign key/i.test(msg))
    return "연결된 데이터가 있어 처리할 수 없어요.";
  if (/null value/i.test(msg)) return "필수 항목이 누락됐어요.";
  if (/check constraint/i.test(msg))
    return "입력값이 허용 범위를 벗어났어요.";
  if (/row-level security|RLS/i.test(msg))
    return "권한이 없어요. 다시 로그인해보세요.";
  if (/JWT|invalid_grant|invalid token/i.test(msg))
    return "세션이 만료됐어요. 다시 로그인해주세요.";
  if (/network|fetch|ENOTFOUND|ETIMEDOUT/i.test(msg))
    return "네트워크 연결을 확인해주세요.";

  return msg || fallback;
}
