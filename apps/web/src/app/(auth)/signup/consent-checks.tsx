import Link from "next/link";

/**
 * 가입 동의 체크박스 — 이용약관(필수), 개인정보처리방침(필수), 마케팅 수신(선택).
 * native required로 미체크 시 submit 차단.
 */
export function ConsentChecks({
  errors,
}: {
  errors?: {
    termsAgreed?: string[];
    privacyAgreed?: string[];
  };
}) {
  return (
    <fieldset className="space-y-3 rounded-md border p-4">
      <legend className="text-xs font-semibold px-1 text-muted-foreground">
        가입 동의
      </legend>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="termsAgreed"
          required
          className="mt-0.5 size-4 accent-current"
          aria-invalid={!!errors?.termsAgreed}
        />
        <span>
          (필수){" "}
          <Link
            href="/terms"
            target="_blank"
            className="text-primary underline-offset-2 hover:underline"
          >
            이용약관
          </Link>
          에 동의합니다
        </span>
      </label>
      {errors?.termsAgreed && (
        <p className="text-xs text-primary">{errors.termsAgreed[0]}</p>
      )}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="privacyAgreed"
          required
          className="mt-0.5 size-4 accent-current"
          aria-invalid={!!errors?.privacyAgreed}
        />
        <span>
          (필수){" "}
          <Link
            href="/privacy"
            target="_blank"
            className="text-primary underline-offset-2 hover:underline"
          >
            개인정보처리방침
          </Link>
          에 동의합니다
        </span>
      </label>
      {errors?.privacyAgreed && (
        <p className="text-xs text-primary">{errors.privacyAgreed[0]}</p>
      )}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="marketingAgreed"
          className="mt-0.5 size-4 accent-current"
        />
        <span>
          (선택) 이벤트·신규 강의 등 마케팅 정보 수신에 동의합니다
        </span>
      </label>
    </fieldset>
  );
}
