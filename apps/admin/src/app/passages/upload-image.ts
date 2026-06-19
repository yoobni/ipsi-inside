"use server";

import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

type Result = { ok: true; url: string } | { ok: false; message: string };

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/**
 * 지문/문항 본문에 들어갈 이미지를 Supabase Storage(question-assets)에 업로드.
 * admin 인증된 사용자만 가능 (RLS로 차단).
 */
export async function uploadImageAction(fd: FormData): Promise<Result> {
  const file = fd.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "파일이 없습니다." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "5MB 이하의 이미지만 업로드 가능합니다." };
  }
  if (!ALLOWED.includes(file.type)) {
    return { ok: false, message: "지원 형식: PNG / JPEG / GIF / WebP" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "인증 필요" };

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `passages/${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("question-assets")
    .upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type,
    });
  if (error) return { ok: false, message: error.message };

  const { data: pub } = supabase.storage
    .from("question-assets")
    .getPublicUrl(path);
  if (!pub?.publicUrl)
    return { ok: false, message: "공개 URL 생성 실패" };
  return { ok: true, url: pub.publicUrl };
}
