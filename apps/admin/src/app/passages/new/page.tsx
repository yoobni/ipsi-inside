import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewPassageClient } from "./new-passage-client";

export default function NewPassagePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/passages">
            <ChevronLeft className="size-4" />
            목록
          </Link>
        </Button>
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">새 지문 등록</h1>
        <p className="text-muted-foreground text-sm">
          지문 1개 + 딸린 문항 N개를 한 번에 등록해요. 우측에 학생 모바일 화면 미리보기가 라이브로 떠요.
        </p>
      </div>

      <NewPassageClient />
    </div>
  );
}
