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
