"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-7 px-6 text-center">
      <span className="text-lg font-semibold">
        입시인사이드<span className="text-primary">.</span>
        <span className="text-muted-foreground ml-1 text-xs">/ 어드민</span>
      </span>
      <div className="space-y-2">
        <p className="text-primary text-5xl font-bold leading-none">404</p>
        <h1 className="text-xl font-bold">페이지를 찾을 수 없어요</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          주소가 바뀌었거나 삭제된 페이지일 수 있어요.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          <ChevronLeft className="size-4" /> 뒤로
        </Button>
        <Button asChild>
          <Link href="/">
            <Home className="size-4" /> 홈으로
          </Link>
        </Button>
      </div>
    </div>
  );
}
