import { DATA_MODE, getSupabaseClient } from "./supabaseClient.js";

const BOARD_IMAGE_BUCKET = "board-images";
const DEFAULT_MAX_SIZE = 1280;
const DEFAULT_QUALITY = 0.8;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const IMAGE_UPLOAD_ERRORS = {
  INVALID_TYPE: "invalid-type",
  DECODE_FAILED: "decode-failed",
  TOO_LARGE: "too-large",
  INVALID_PATH: "invalid-path",
  CONFIGURATION: "configuration",
  NETWORK: "network",
  UPLOAD_FAILED: "upload-failed",
};

const ERROR_MESSAGES = {
  [IMAGE_UPLOAD_ERRORS.INVALID_TYPE]: "이미지 파일만 선택할 수 있습니다.",
  [IMAGE_UPLOAD_ERRORS.DECODE_FAILED]: "지원하지 않는 이미지 형식입니다. JPG, PNG 또는 WebP 파일을 선택해 주세요.",
  [IMAGE_UPLOAD_ERRORS.TOO_LARGE]: "이미지 변환 후 용량이 5MB를 초과합니다. 더 작은 사진을 선택해 주세요.",
  [IMAGE_UPLOAD_ERRORS.INVALID_PATH]: "장표 업로드 경로를 만들 수 없습니다. 과정과 활동 정보를 다시 확인해 주세요.",
  [IMAGE_UPLOAD_ERRORS.CONFIGURATION]: "이미지 저장소 설정을 확인할 수 없습니다. 관리자에게 문의해 주세요.",
  [IMAGE_UPLOAD_ERRORS.NETWORK]: "네트워크 오류로 이미지를 업로드하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.",
  [IMAGE_UPLOAD_ERRORS.UPLOAD_FAILED]: "이미지 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.",
};

class ImageStoreError extends Error {
  constructor(code, message = ERROR_MESSAGES[code]) {
    super(message);
    this.name = "ImageStoreError";
    this.code = code;
  }
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new ImageStoreError(IMAGE_UPLOAD_ERRORS.DECODE_FAILED));
    reader.readAsDataURL(blob);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new ImageStoreError(IMAGE_UPLOAD_ERRORS.DECODE_FAILED));
    image.src = source;
  });
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new ImageStoreError(IMAGE_UPLOAD_ERRORS.DECODE_FAILED));
    }, "image/jpeg", quality);
  });
}

async function toJpegBlob(fileOrDataUrl, maxSize, quality) {
  if (typeof fileOrDataUrl !== "string" && fileOrDataUrl?.type && !fileOrDataUrl.type.startsWith("image/")) {
    throw new ImageStoreError(IMAGE_UPLOAD_ERRORS.INVALID_TYPE);
  }

  let source = null;
  let revokeSource = false;
  if (typeof fileOrDataUrl === "string") {
    if (!fileOrDataUrl.startsWith("data:image/")) throw new ImageStoreError(IMAGE_UPLOAD_ERRORS.INVALID_TYPE);
    source = fileOrDataUrl;
  } else if (fileOrDataUrl instanceof Blob) {
    source = URL.createObjectURL(fileOrDataUrl);
    revokeSource = true;
  } else {
    throw new ImageStoreError(IMAGE_UPLOAD_ERRORS.INVALID_TYPE);
  }

  try {
    const image = await loadImage(source);
    const largestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
    if (!largestSide) throw new ImageStoreError(IMAGE_UPLOAD_ERRORS.DECODE_FAILED);
    const ratio = Math.min(1, maxSize / largestSide);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * ratio));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new ImageStoreError(IMAGE_UPLOAD_ERRORS.DECODE_FAILED);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvasToJpegBlob(canvas, quality);
  } finally {
    if (revokeSource) URL.revokeObjectURL(source);
  }
}

export function createBoardImagePath(meta) {
  const courseCode = String(meta.courseId || meta.courseCode || "").trim().toUpperCase();
  const roundId = String(meta.roundId || "").trim();
  if (!/^NH-[0-9]+$/.test(courseCode) || !roundId || /[\\/]/.test(roundId)) {
    throw new ImageStoreError(IMAGE_UPLOAD_ERRORS.INVALID_PATH);
  }
  return `${courseCode}/${roundId}/${crypto.randomUUID()}.jpg`;
}

function uploadErrorCode(error) {
  const message = `${error?.message || ""} ${error?.error || ""}`.toLowerCase();
  return /(network|fetch|timeout|offline|connection)/.test(message)
    ? IMAGE_UPLOAD_ERRORS.NETWORK
    : IMAGE_UPLOAD_ERRORS.UPLOAD_FAILED;
}

export async function putImage(fileOrDataUrl, meta = {}) {
  try {
    const blob = await toJpegBlob(
      fileOrDataUrl,
      meta.maxSize || DEFAULT_MAX_SIZE,
      meta.quality ?? DEFAULT_QUALITY,
    );
    if (blob.size > MAX_UPLOAD_BYTES) throw new ImageStoreError(IMAGE_UPLOAD_ERRORS.TOO_LARGE);

    if (DATA_MODE === "local") {
      return { ok: true, url: await readBlobAsDataUrl(blob), path: null };
    }

    const clientResult = getSupabaseClient();
    if (!clientResult.ok) {
      throw new ImageStoreError(IMAGE_UPLOAD_ERRORS.CONFIGURATION, clientResult.error);
    }
    const path = createBoardImagePath(meta);
    const { error } = await clientResult.client.storage
      .from(BOARD_IMAGE_BUCKET)
      .upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (error) throw new ImageStoreError(uploadErrorCode(error), error.message);

    const { data } = clientResult.client.storage
      .from(BOARD_IMAGE_BUCKET)
      .getPublicUrl(path);
    if (!data?.publicUrl) throw new ImageStoreError(IMAGE_UPLOAD_ERRORS.UPLOAD_FAILED);
    return { ok: true, url: data.publicUrl, path };
  } catch (error) {
    const code = error instanceof ImageStoreError ? error.code : uploadErrorCode(error);
    return {
      ok: false,
      url: null,
      path: null,
      error: error instanceof Error ? error.message : String(error),
      errorCode: code,
      userMessage: ERROR_MESSAGES[code] || ERROR_MESSAGES[IMAGE_UPLOAD_ERRORS.UPLOAD_FAILED],
    };
  }
}

export async function deleteImage() {
  // STEP 4 정책은 Storage DELETE를 허용하지 않으므로 자동 정리 없이 no-op으로 유지합니다.
  return { ok: true, blockedByPolicy: true };
}
