// src/utils/compressImage.ts
// Shrinks photos in the browser before upload so a multi-photo request stays under
// Vercel's 4.5 MB request-body limit for serverless functions.

const MAX_DIMENSION = 1600;          // px — longest side after resizing
const SKIP_BELOW    = 500 * 1024;    // files smaller than this are sent as-is
const JPEG_QUALITY  = 0.85;

/** Resize/re-encode a photo to JPEG. Returns the original file if it's small or can't be decoded. */
export async function compressImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size <= SKIP_BELOW) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale  = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width  = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#ffffff';                 // flatten PNG transparency onto white
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;   // never make a file bigger

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;   // unsupported format in this browser — upload the original
  }
}

/** Max total upload size per request (Vercel allows 4.5 MB; leave room for the form fields). */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
