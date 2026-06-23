import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewMaterialForm } from "../new-form";

export default function NewMaterialPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/materials">
            <ChevronLeft className="size-4" />
            자료 목록
          </Link>
        </Button>
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">새 자료 업로드</h1>
        <p className="text-muted-foreground text-sm">
          PDF (≤30MB)를 올리고 배부 대상을 선택해요. 저장 후 [발행]을 누르면
          알림이 발송돼요.
        </p>
      </div>

      <NewMaterialForm />
    </div>
  );
}
