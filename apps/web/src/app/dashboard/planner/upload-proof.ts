"use server";

import { friendlyDbError } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

type Result = { ok: true; photo_path: string } | { ok: false; message: string };

// 버킷 제한(5MiB)과 같은 값. 클라에서 리사이즈하므로 정상 경로에선 닿지 않는다.
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/**
 * 플래너 과제 인증사진 업로드 (planner-proofs 버킷).
 *
 * 경로는 반드시 `{본인 uid}/{uuid}.jpg` — 첫 폴더가 auth.uid()일 때만 통과하는
 * storage 정책이 걸려 있어 남의 폴더엔 못 쓴다. 키는 ASCII만 (한글 키는
 * Storage가 `Invalid key`로 거부 — 커밋 ff47490).
 *
 * 여기서는 파일만 올리고, planner_task_checks.photo_path 저장은
 * submitPlannerChecksAction이 한다(체크 상태와 한 번에 확정해야 하므로).
 */
export async function uploadPlannerProofAction(fd: FormData): Promise<Result> {
  const file = fd.get("file");
  if (!(file instanceof File)) return { ok: false, message: "파일이 없어요" };
  if (file.size === 0) return { ok: false, message: "빈 파일이에요" };
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "5MB 이하의 사진만 올릴 수 있어요" };
  }
  if (!ALLOWED.includes(file.type)) {
    return { ok: false, message: "사진(jpg/png/webp)만 올릴 수 있어요" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요해요" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "student") {
    return { ok: false, message: "학생만 사진을 올릴 수 있어요" };
  }
  if (profile.status !== "approved") {
    return { ok: false, message: "승인 후 이용할 수 있어요" };
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("planner-proofs")
    .upload(path, file, {
      cacheControl: "0",
      upsert: false,
      contentType: file.type,
    });
  if (error) return { ok: false, message: friendlyDbError(error) };

  return { ok: true, photo_path: path };
}
