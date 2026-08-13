function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read the image file."));
    reader.readAsDataURL(file);
  });
}

function resizeDataUrl(dataUrl, maxSize = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const largestSide = Math.max(image.width, image.height);
      if (largestSide <= maxSize) {
        resolve(dataUrl);
        return;
      }
      const ratio = maxSize / largestSide;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * ratio);
      canvas.height = Math.round(image.height * ratio);
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Unable to start image conversion."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => reject(new Error("Unsupported image format."));
    image.src = dataUrl;
  });
}

export async function putImage(fileOrDataUrl, meta = {}) {
  try {
    const dataUrl = typeof fileOrDataUrl === "string"
      ? fileOrDataUrl
      : await readFileAsDataUrl(fileOrDataUrl);
    const url = await resizeDataUrl(dataUrl, meta.maxSize || 1280, meta.quality ?? 0.8);
    return { ok: true, url };
  } catch (error) {
    return { ok: false, url: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function deleteImage() {
  return { ok: true };
}
