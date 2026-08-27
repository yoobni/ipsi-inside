"use server";

import { friendlyDbError } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

type Result = { ok: true; image_path: string } | { ok: false; message: string };

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/**
 * Q&A 질문 첨부 사진 업로드 (qna-images 버킷).
 * planner-proofs와 같은 패턴 — 경로 `{본인 uid}/{uuid}.ext`, ASCII 키.
 * 파일만 올리고 image_path는 질문 저장 액션이 함께 확정한다.
 */
export async function uploadQnaImageAction(fd: FormData): Promise<Result> {
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
  if (profile?.role !== "student" || profile.status !== "approved") {
    return { ok: false, message: "학생만 첨부할 수 있어요" };
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("qna-images")
    .upload(path, file, { cacheControl: "0", upsert: false, contentType: file.type });
  if (error) return { ok: false, message: friendlyDbError(error) };

  return { ok: true, image_path: path };
}
