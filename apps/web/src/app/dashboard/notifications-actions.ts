"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

type Result = { ok: true } | { ok: false; message: string };

export async function markNotificationReadAction(id: string): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tests");
  revalidatePath("/dashboard/journal");
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "인증 필요" };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tests");
  revalidatePath("/dashboard/journal");
  return { ok: true };
}
