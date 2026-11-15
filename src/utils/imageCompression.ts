/**
 * Reads an uploaded image/file and compresses oversized raster images
 * client-side via Canvas so JSON payloads stay well under serverless body limits (4.5 MB).
 */
export async function readAndOptimizeFileAsDataUrl(
  file: File,
  options: { maxDimension?: number; maxTargetBytes?: number; quality?: number } = {}
): Promise<string> {
  const {
    maxDimension = 1600,
    maxTargetBytes = 1.5 * 1024 * 1024,
    quality = 0.82
  } = options;

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not parse file.'));
    reader.readAsDataURL(file);
  });

  const isRasterImage =
    file.type === 'image/png' ||
    file.type === 'image/jpeg' ||
    file.type === 'image/jpg' ||
    file.type === 'image/webp';

  // Skip compression for non-images (e.g. PDF) or already compact images
  if (!isRasterImage || file.size <= maxTargetBytes) {
    return rawDataUrl;
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Image decode failed'));
      image.src = rawDataUrl;
    });

    let { width, height } = img;
    if (width > maxDimension || height > maxDimension) {
      const ratio = Math.min(maxDimension / width, maxDimension / height);
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return rawDataUrl;

    ctx.drawImage(img, 0, 0, width, height);

    // Preserve PNG transparency for PNG logos if compact; otherwise encode JPEG/WEBP
    const outputMime = file.type === 'image/png' ? 'image/webp' : file.type;
    const compressed = canvas.toDataURL(outputMime, quality);

    return compressed.length < rawDataUrl.length ? compressed : rawDataUrl;
  } catch {
    return rawDataUrl;
  }
}
