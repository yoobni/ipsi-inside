import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProfileForm, type ProfileInitial } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);

  if (state.kind === "guest") redirect("/login");
  if (state.kind !== "ok" || state.status !== "approved") redirect("/pending");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, school, grade, role")
    .eq("id", state.userId)
    .maybeSingle();

  const initial: ProfileInitial = {
    role: (profile?.role as "student" | "parent") ?? "student",
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    school: profile?.school ?? null,
    grade: profile?.grade ?? null,
  };

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-hairline sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-6 py-4 backdrop-blur">
        <Wordmark size="md" />
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10 space-y-6">
        <Link
          href="/dashboard"
          className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          홈
        </Link>
        <div className="space-y-1">
          <h1 className="font-display text-[28px] leading-tight">내 정보</h1>
          <p className="text-muted-foreground text-sm">
            이름, 전화번호 같은 정보를 직접 수정할 수 있어요.
          </p>
        </div>
        <ProfileForm initial={initial} />
      </main>
    </div>
  );
}
