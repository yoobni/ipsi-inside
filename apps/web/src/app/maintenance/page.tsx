import { Wordmark } from "@/components/wordmark";

export const dynamic = "force-static";

export const metadata = {
  title: "점검 중 · 입시인사이드",
};

export default function MaintenancePage() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-7 px-6 text-center">
      <Wordmark size="xl" asLink={false} />
      <div className="space-y-2.5">
        <h1 className="font-display text-2xl">잠시 점검 중이에요</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          더 나은 서비스를 위해 시스템을 점검하고 있어요.
          <br />
          잠시 후 다시 접속해 주세요.
        </p>
      </div>
    </div>
  );
}
