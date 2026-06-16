import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * 워드마크: `입시인사이드.` — 마지막 마침표는 항상 레드.
 * 기본적으로 클릭 시 홈(/)으로 이동. `asLink={false}`로 비활성화 가능.
 */
export function Wordmark({
  className,
  size = "md",
  asLink = true,
  href = "/",
}: {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  asLink?: boolean;
  href?: string;
}) {
  const sizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
    xl: "text-[40px] leading-none",
  };

  const content = (
    <>
      입시인사이드<span className="text-primary">.</span>
    </>
  );

  const baseClass = cn("font-display tracking-tight", sizes[size], className);

  if (asLink) {
    return (
      <Link
        href={href}
        aria-label="입시인사이드 홈으로"
        className={cn(
          baseClass,
          "inline-block transition-opacity hover:opacity-80",
        )}
      >
        {content}
      </Link>
    );
  }

  return <span className={baseClass}>{content}</span>;
}
