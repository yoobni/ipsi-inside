/**
 * 임시 비밀번호 생성. 원장이 구두나 문자로 전달하므로 헷갈리는 글자
 * (0/O, 1/l/I)를 빼고, 읽어주기 쉬운 10자로 만든다.
 * 회원(학생·학부모) 재설정과 조교 계정 발급이 같이 쓴다.
 */
export function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
