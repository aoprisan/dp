import { rgbToHex, rgbToHsl } from './color';

type Px = [number, number, number];

/** Dominant colors via median-cut on a downscaled canvas (§1). Transparent
 * pixels (bg-removed cutouts) and near-borders are ignored. */
export async function extractColors(blob: Blob, count = 3): Promise<string[]> {
  const bitmap = await createImageBitmap(blob);
  const size = 80;
  const scale = Math.min(size / bitmap.width, size / bitmap.height, 1);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const data = ctx.getImageData(0, 0, w, h).data;

  const pixels: Px[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // transparent (cutout background)
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (!pixels.length) return [];

  const boxes: Px[][] = [pixels];
  while (boxes.length < count) {
    boxes.sort((a, b) => b.length - a.length);
    const box = boxes.shift()!;
    if (box.length < 2) {
      boxes.push(box);
      break;
    }
    // split on the channel with the widest range, at the median
    const ranges = [0, 1, 2].map((c) => {
      let min = 255,
        max = 0;
      for (const p of box) {
        if (p[c] < min) min = p[c];
        if (p[c] > max) max = p[c];
      }
      return max - min;
    });
    const ch = ranges.indexOf(Math.max(...ranges));
    box.sort((a, b) => a[ch] - b[ch]);
    const mid = box.length >> 1;
    boxes.push(box.slice(0, mid), box.slice(mid));
  }

  return boxes
    .sort((a, b) => b.length - a.length)
    .map((box) => {
      const sum = box.reduce<Px>((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
      return rgbToHex(sum[0] / box.length, sum[1] / box.length, sum[2] / box.length);
    });
}

const HUE_BUCKET = 30;

/** Dominant wardrobe color for the accent (§2): cluster saturated item colors
 * by hue, take the biggest cluster's most common member. Returns undefined if
 * the wardrobe is all neutrals or empty. */
export function dominantAccent(itemColors: string[][]): string | undefined {
  const buckets = new Map<number, { hex: string; weight: number }[]>();
  for (const colors of itemColors) {
    colors.forEach((hex, i) => {
      const [h, s, l] = rgbToHsl(
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      );
      if (s < 0.15 || l < 0.08 || l > 0.92) return; // neutrals can't be the accent
      const bucket = Math.round(h / HUE_BUCKET) % (360 / HUE_BUCKET);
      const weight = 3 - i; // primary color counts more
      const arr = buckets.get(bucket) ?? [];
      arr.push({ hex, weight });
      buckets.set(bucket, arr);
    });
  }
  let best: { hex: string; weight: number }[] | undefined;
  let bestWeight = 0;
  for (const arr of buckets.values()) {
    const w = arr.reduce((s, e) => s + e.weight, 0);
    if (w > bestWeight) {
      bestWeight = w;
      best = arr;
    }
  }
  if (!best) return undefined;
  return best.sort((a, b) => b.weight - a.weight)[0].hex;
}
