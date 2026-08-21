"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  MARKETING_CHANNELS,
  MARKETING_ROWS,
  OPTIONAL_REFUSAL_NOTICE,
  REQUIRED_REFUSAL_NOTICE,
  requiredCollectionRows,
  type CollectionRow,
} from "@ipsi/types";
import { cn } from "@/lib/utils";

/**
 * 가입 동의.
 *
 * 예전엔 "개인정보처리방침에 동의합니다" 한 칸이었다. 처리방침은 사업자가
 * 공개(고지)하는 문서이고, 받아야 하는 건 **개인정보 수집·이용 동의**다.
 * 그리고 법 제15조 제2항은 동의를 받는 그 시점에 네 가지를 알리도록 요구한다:
 *   ① 수집·이용 목적 ② 수집 항목 ③ 보유·이용 기간 ④ 거부권과 거부 시 불이익
 * 링크만 걸어두면 이 넷이 동의 화면에 없다. 그래서 표를 화면 안에 편다.
 *
 * 표 내용은 @ipsi/types/consent 한 곳에서 온다 — 처리방침 §1과 같은 데이터다.
 */

export type ConsentErrors = {
  termsAgreed?: string[];
  privacyAgreed?: string[];
  age14Confirmed?: string[];
  childInfoAgreed?: string[];
};

export function ConsentChecks({
  role,
  errors,
}: {
  role: "student" | "parent";
  errors?: ConsentErrors;
}) {
  // 전체 동의는 편의 기능일 뿐이라 개별 체크 상태를 통제하지 않는다.
  // (필수/선택을 한 번에 켜는 다크패턴이 되지 않게 선택 항목도 같이 표시한다)
  const [allChecked, setAllChecked] = useState(false);
  const rows = requiredCollectionRows(role);

  const toggleAll = (next: boolean) => {
    setAllChecked(next);
    document
      .querySelectorAll<HTMLInputElement>("input[data-consent]")
      .forEach((el) => {
        el.checked = next;
      });
  };

  return (
    <fieldset className="border-hairline space-y-4 rounded-[14px] border p-4">
      <legend className="text-muted-foreground px-1 text-xs font-semibold">
        가입 동의
      </legend>

      <label className="border-hairline flex items-start gap-2 border-b pb-4 text-sm font-bold">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={(e) => toggleAll(e.target.checked)}
          className="mt-0.5 size-4 accent-current"
        />
        <span>아래 내용에 모두 동의합니다 (선택 항목 포함)</span>
      </label>

      <ConsentRow
        name="age14Confirmed"
        required
        error={errors?.age14Confirmed?.[0]}
        onManualChange={() => setAllChecked(false)}
        label={
          <>
            <Req /> 만 14세 이상입니다
          </>
        }
      >
        <p>
          만 14세 미만은 법정대리인의 동의가 필요해 온라인 가입을 받지 않습니다.
          학원으로 문의해주세요.
        </p>
      </ConsentRow>

      <ConsentRow
        name="termsAgreed"
        required
        error={errors?.termsAgreed?.[0]}
        onManualChange={() => setAllChecked(false)}
        label={
          <>
            <Req />{" "}
            <DocLink href="/terms">이용약관</DocLink>에 동의합니다
          </>
        }
      />

      <ConsentRow
        name="privacyAgreed"
        required
        error={errors?.privacyAgreed?.[0]}
        onManualChange={() => setAllChecked(false)}
        label={
          <>
            <Req /> 개인정보 수집·이용에 동의합니다
          </>
        }
        detailLabel="수집 항목·목적·보유기간 보기"
        defaultOpen
      >
        <CollectionTable rows={rows} />
        <p className="mt-2">{REQUIRED_REFUSAL_NOTICE}</p>
        <p className="mt-1">
          자세한 내용은 <DocLink href="/privacy">개인정보처리방침</DocLink>에서
          확인할 수 있어요.
        </p>
      </ConsentRow>

      {role === "parent" && (
        <ConsentRow
          name="childInfoAgreed"
          required
          error={errors?.childInfoAgreed?.[0]}
          onManualChange={() => setAllChecked(false)}
          label={
            <>
              <Req /> 자녀의 개인정보 제공에 동의합니다
            </>
          }
        >
          <p>
            자녀 계정을 찾기 위해 자녀의 이름과 휴대폰 번호를 입력하게 됩니다.
            본인이 자녀의 법정대리인으로서 이 정보를 제공하는 것에 동의해야
            해요.
          </p>
        </ConsentRow>
      )}

      <ConsentRow
        name="marketingAgreed"
        error={undefined}
        onManualChange={() => setAllChecked(false)}
        label={
          <>
            <Opt /> 광고성 정보 수신에 동의합니다
          </>
        }
        note={
          <>
            <p>
              전송 수단: <strong>{MARKETING_CHANNELS}</strong>
            </p>
            <p className="mt-0.5">{OPTIONAL_REFUSAL_NOTICE}</p>
          </>
        }
        detailLabel="수집 항목·목적·보유기간 보기"
      >
        <CollectionTable rows={MARKETING_ROWS} />
        <p className="mt-2">가입 후 [내 정보]에서 언제든 철회할 수 있어요.</p>
      </ConsentRow>
    </fieldset>
  );
}

function Req() {
  return <span className="text-primary font-bold">(필수)</span>;
}

function Opt() {
  return <span className="text-muted-foreground font-bold">(선택)</span>;
}

function DocLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </Link>
  );
}

function ConsentRow({
  name,
  label,
  required,
  error,
  note,
  children,
  detailLabel,
  defaultOpen,
  onManualChange,
}: {
  name: string;
  label: React.ReactNode;
  required?: boolean;
  error?: string;
  /** 접기 안에 숨기면 안 되는 고지 — 체크 시점에 반드시 보여야 하는 문구 */
  note?: React.ReactNode;
  children?: React.ReactNode;
  detailLabel?: string;
  defaultOpen?: boolean;
  onManualChange: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="space-y-1.5">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name={name}
          data-consent
          required={required}
          onChange={(e) => {
            // 개별 체크를 끄면 "모두 동의"도 풀린다 — 켜진 채로 남으면 거짓 표시다
            if (!e.target.checked) onManualChange();
          }}
          className="mt-0.5 size-4 accent-current"
          aria-invalid={!!error}
        />
        <span>{label}</span>
      </label>

      {error && <p className="text-primary pl-6 text-xs">{error}</p>}

      {note && (
        <div className="text-muted-foreground pl-6 text-xs leading-relaxed">
          {note}
        </div>
      )}

      {children &&
        (detailLabel ? (
          <div className="pl-6">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
            >
              {detailLabel}
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>
            {open && (
              <div className="text-muted-foreground mt-2 text-xs leading-relaxed">
                {children}
              </div>
            )}
          </div>
        ) : (
          <div className="text-muted-foreground pl-6 text-xs leading-relaxed">
            {children}
          </div>
        ))}
    </div>
  );
}

function CollectionTable({ rows }: { rows: CollectionRow[] }) {
  return (
    <div className="border-hairline overflow-x-auto rounded-md border">
      <table className="w-full min-w-[440px] text-left text-xs">
        <thead className="border-hairline bg-surface-2 border-b">
          <tr className="[&>th]:px-2.5 [&>th]:py-1.5 [&>th]:font-semibold">
            <th>수집·이용 목적</th>
            <th>수집 항목</th>
            <th className="whitespace-nowrap">보유·이용 기간</th>
          </tr>
        </thead>
        <tbody className="divide-hairline divide-y">
          {rows.map((row) => (
            <tr
              key={row.purpose}
              className="[&>td]:px-2.5 [&>td]:py-1.5 [&>td]:align-top"
            >
              <td>{row.purpose}</td>
              <td>{row.items}</td>
              <td>{row.retention}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
