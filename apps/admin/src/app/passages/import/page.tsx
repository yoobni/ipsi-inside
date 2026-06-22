import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportClient } from "./import-client";

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/passages">
            <ChevronLeft className="size-4" />
            지문 목록
          </Link>
        </Button>
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">CSV 일괄 가져오기</h1>
        <p className="text-muted-foreground text-sm">
          엑셀/스프레드시트에서 작성한 CSV로 지문과 문항을 한 번에 등록해요.
        </p>
      </div>

      <ImportClient />
    </div>
  );
}
