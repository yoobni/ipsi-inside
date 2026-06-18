/**
 * KST(Asia/Seoul) 시간 유틸. KST는 UTC+9, DST 없음.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 현재 시각 기준 KST 날짜 문자열 (YYYY-MM-DD) */
export function todayKst(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 다음 KST 06:00 시점을 UTC Date로 반환 (이미 지났으면 다음날 06:00) */
export function nextKstSixAm(now: Date = new Date()): Date {
  const nowMs = now.getTime();
  // KST wall-clock 으로 표현된 시점 (UTC로 읽으면 wall clock과 동일하게 보임)
  const kstWall = new Date(nowMs + KST_OFFSET_MS);
  // 오늘 KST 06:00의 wall-clock 시점
  const todayKst6Wall = Date.UTC(
    kstWall.getUTCFullYear(),
    kstWall.getUTCMonth(),
    kstWall.getUTCDate(),
    6,
    0,
    0,
    0,
  );
  // wall-clock → 실제 UTC ms
  const todayKst6Utc = todayKst6Wall - KST_OFFSET_MS;
  if (todayKst6Utc > nowMs) return new Date(todayKst6Utc);
  return new Date(todayKst6Utc + 24 * 60 * 60 * 1000);
}
