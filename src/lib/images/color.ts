// Small color math shared by palette extraction and the accent store.

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  (r /= 255), (g /= 255), (b /= 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Coarse human name for a hex color — used by the serializer and stats. */
export function colorName(hex: string): string {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  if (l > 0.92) return 'white';
  if (l < 0.1) return 'black';
  if (s < 0.12) return l > 0.6 ? 'light gray' : 'gray';
  if (s < 0.3 && l > 0.55 && h >= 20 && h <= 80) return 'beige';
  if (h < 15 || h >= 345) return l < 0.35 ? 'burgundy' : 'red';
  if (h < 40) return l < 0.4 ? 'brown' : 'orange';
  if (h < 70) return s < 0.45 && l < 0.5 ? 'olive' : 'yellow';
  if (h < 160) return 'green';
  if (h < 200) return 'teal';
  if (h < 250) return l < 0.3 ? 'navy' : 'blue';
  if (h < 290) return 'purple';
  return 'pink';
}

/** Shift lightness away from bg until contrast ≥ target (§2 rule 7). */
export function adjustForContrast(hex: string, bg: string, target = 4.5): string {
  if (contrast(hex, bg) >= target) return hex;
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  const darkBg = luminance(bg) < 0.5;
  let cur = l;
  for (let i = 0; i < 40; i++) {
    cur += darkBg ? 0.02 : -0.02;
    cur = Math.max(0.02, Math.min(0.98, cur));
    const candidate = rgbToHex(...hslToRgb(h, s, cur));
    if (contrast(candidate, bg) >= target) return candidate;
  }
  return darkBg ? '#f2f0ea' : '#1f1e1b';
}
