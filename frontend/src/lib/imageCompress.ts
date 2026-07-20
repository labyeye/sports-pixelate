// Client-side image compression so uploads stay under the backend's Multer
// size limit. Resizes large images down and iteratively lowers JPEG quality
// until the file is at (or the original already was under) the target size.
const MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB
const MAX_DIMENSION = 1920;
const MIN_QUALITY = 0.4;

export async function compressImageFile(
  file: File,
  maxSizeBytes: number = MAX_SIZE_BYTES,
): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= maxSizeBytes) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to load image"));
      el.src = objectUrl;
    });

    let width = img.width;
    let height = img.height;
    const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height, 1);
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    let quality = 0.85;
    let blob: Blob | null = null;

    while (true) {
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (!blob) return file;

      if (blob.size <= maxSizeBytes || quality <= MIN_QUALITY) {
        // Still oversized after hitting the quality floor — shrink dimensions
        // further and try once more, rather than give up.
        if (blob.size > maxSizeBytes && width > 640) {
          width = Math.round(width * 0.8);
          height = Math.round(height * 0.8);
          quality = 0.7;
          continue;
        }
        break;
      }
      quality -= 0.1;
    }

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
