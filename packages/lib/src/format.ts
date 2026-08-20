/**
 * 바이트 → 사람이 읽는 크기. 작은 파일이 "0.0MB"로 뭉개지지 않게 KB/B 병기.
 *  >=1MB → "1.4MB", >=1KB → "48KB", 그 외 → "320B"
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0KB";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${Math.round(bytes)}B`;
}

/**
 * 전화번호 표기 통일 — 저장값은 그대로 두고 화면에서만 하이픈을 넣는다.
 * 같은 사람이 "01056683359"와 "010-5668-3359"로 섞여 보이던 문제 해결.
 *
 * 자릿수를 못 맞추면 원본을 그대로 돌려준다 — 임의로 자르면 틀린 번호가 된다.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) {
    // 02는 두 자리 지역번호 (02-1234-5678), 그 외는 3자리 (010-123-4567)
    return d.startsWith('02')
      ? `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`
      : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (d.length === 9 && d.startsWith('02')) {
    return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  }
  return raw;
}
