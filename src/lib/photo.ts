import { uid } from './db';
import type { Photo } from './types';

const MAX_EDGE = 1600;

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function compressPhoto(file: File): Promise<Photo> {
  const src = await decodeImage(file);
  const w = src instanceof ImageBitmap ? src.width : src.naturalWidth;
  const h = src instanceof ImageBitmap ? src.height : src.naturalHeight;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d')!.drawImage(src, 0, 0, canvas.width, canvas.height);
  if (src instanceof ImageBitmap) src.close();
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.85));
  return { id: uid(), blob };
}
