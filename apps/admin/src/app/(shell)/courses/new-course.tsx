"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createCourseAction } from "./actions";
import { CourseFields, type CourseFieldsValue, type GroupOption } from "./course-fields";

const EMPTY = (): CourseFieldsValue => ({ title: "", description: "", groupIds: new Set() });

export function NewCourseButton({ groups }: { groups: GroupOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<CourseFieldsValue>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const r = await createCourseAction({
        title: value.title,
        description: value.description.trim() || null,
        groupIds: [...value.groupIds],
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setOpen(false);
      setValue(EMPTY());
      router.push(`/courses/${r.id}`);
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="self-start">
        <Plus className="size-4" />새 코스
      </Button>
      <Sheet open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>새 코스</SheetTitle>
            <SheetDescription className="text-xs">만든 뒤에 회차와 회차별 묶음을 채워요.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <CourseFields value={value} onChange={setValue} groups={groups} />
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button onClick={submit} disabled={pending || value.title.trim().length < 2}>
              {pending ? "만드는 중…" : "만들기"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
