const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function todayKst(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 다음 KST 06:00 시점을 UTC Date로 반환 */
export function nextKstSixAm(now: Date = new Date()): Date {
  const nowMs = now.getTime();
  const kstWall = new Date(nowMs + KST_OFFSET_MS);
  const todayKst6Wall = Date.UTC(
    kstWall.getUTCFullYear(),
    kstWall.getUTCMonth(),
    kstWall.getUTCDate(),
    6,
    0,
    0,
    0,
  );
  const todayKst6Utc = todayKst6Wall - KST_OFFSET_MS;
  if (todayKst6Utc > nowMs) return new Date(todayKst6Utc);
  return new Date(todayKst6Utc + 24 * 60 * 60 * 1000);
}
