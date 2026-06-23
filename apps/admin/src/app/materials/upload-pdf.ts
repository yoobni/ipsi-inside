"use server";

import { friendlyDbError } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

type Result =
  | {
      ok: true;
      storage_path: string;
      file_name: string;
      file_size_bytes: number;
    }
  | { ok: false; message: string };

const MAX_BYTES = 30 * 1024 * 1024; // 30MB
const ALLOWED = ["application/pdf"];

/**
 * 자료 PDF를 Supabase Storage(materials 버킷)에 업로드.
 * admin 인증된 사용자만 가능 (RLS로 차단).
 * row 생성 전 uuid prefix로 path 발급 → createMaterialAction에서 row와 함께 저장.
 */
export async function uploadPdfAction(fd: FormData): Promise<Result> {
  const file = fd.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "파일이 없습니다." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "30MB 이하의 PDF만 업로드 가능합니다." };
  }
  if (!ALLOWED.includes(file.type)) {
    return { ok: false, message: "PDF 파일만 업로드 가능합니다." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "인증 필요" };

  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w가-힣.\-]/g, "_");
  const path = `${id}/${safeName}`;

  const { error } = await supabase.storage
    .from("materials")
    .upload(path, file, {
      cacheControl: "0",
      upsert: false,
      contentType: "application/pdf",
    });
  if (error) return { ok: false, message: friendlyDbError(error) };

  return {
    ok: true,
    storage_path: path,
    file_name: file.name,
    file_size_bytes: file.size,
  };
}
