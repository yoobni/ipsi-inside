import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewTestSheetClient } from "./new-test-sheet-client";

export default function NewTestSheetPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tests">
            <ChevronLeft className="size-4" />
            목록
          </Link>
        </Button>
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">새 시험지</h1>
        <p className="text-muted-foreground text-sm">
          시험지 정보를 입력하고 문항을 추가하세요. 정답·단원이 채점/리포트 기반이에요.
        </p>
      </div>

      <NewTestSheetClient />
    </div>
  );
}
