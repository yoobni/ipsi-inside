/**
 * 브라우저 canvas 이미지 리사이즈 — 플래너 인증사진 업로드용.
 *
 * 폰 카메라 원본은 5~10MB라 그대로 올리면 버킷 제한(5MiB)에 걸리고
 * 학생 데이터도 태운다. 긴 변 1600px / jpeg 0.8로 줄여 200~400KB로 만든다.
 *
 * EXIF 회전은 createImageBitmap의 imageOrientation:"from-image"로 처리한다.
 * (폰 세로 사진이 눕는 문제 — canvas는 EXIF를 스스로 반영하지 않음)
 */

export const PROOF_MAX_EDGE = 1600;
export const PROOF_JPEG_QUALITY = 0.8;

export async function resizeImageToJpeg(
  file: File,
  maxEdge: number = PROOF_MAX_EDGE,
  quality: number = PROOF_JPEG_QUALITY,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("캔버스를 만들 수 없어요");

    // jpeg는 투명도가 없어 png 원본의 투명 영역이 검게 나온다 — 흰 배경을 깔아둔다
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new Error("이미지를 변환할 수 없어요");
    return blob;
  } finally {
    bitmap.close();
  }
}
