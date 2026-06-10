import imageCompression from 'browser-image-compression';

/** Pipeline (§1): pick → compress to ≤1200px/~200KB WebP + 320px thumb. */
export async function compressPhoto(input: Blob): Promise<{ blob: Blob; thumb: Blob }> {
  const file =
    input instanceof File ? input : new File([input], 'photo.png', { type: input.type || 'image/png' });
  const blob = await imageCompression(file, {
    maxWidthOrHeight: 1200,
    maxSizeMB: 0.2,
    fileType: 'image/webp',
    initialQuality: 0.85,
    useWebWorker: true,
  });
  const thumb = await imageCompression(file, {
    maxWidthOrHeight: 320,
    maxSizeMB: 0.05,
    fileType: 'image/webp',
    initialQuality: 0.8,
    useWebWorker: true,
  });
  return { blob, thumb };
}

/** Cutouts stay PNG: alpha is preserved and the type marks them as cutouts
 * for contain-fit rendering (§2 rule 4). */
export async function compressCutout(input: Blob): Promise<{ blob: Blob; thumb: Blob }> {
  const file = new File([input], 'cutout.png', { type: 'image/png' });
  const blob = await imageCompression(file, {
    maxWidthOrHeight: 1200,
    maxSizeMB: 0.4,
    fileType: 'image/png',
    useWebWorker: true,
  });
  const thumb = await imageCompression(file, {
    maxWidthOrHeight: 320,
    maxSizeMB: 0.08,
    fileType: 'image/png',
    useWebWorker: true,
  });
  return { blob, thumb };
}
