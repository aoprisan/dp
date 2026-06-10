import { db } from '$lib/db/schema';
import { dominantAccent } from '$lib/images/palette';
import { adjustForContrast, hexToRgb } from '$lib/images/color';

export const FALLBACK_ACCENT = '#185fa5';

/** Re-sample the wardrobe's dominant color (§2) — called on item add/delete. */
export async function recomputeAccent() {
  try {
    const items = await db.items.filter((i) => !i.archived).toArray();
    const accent = dominantAccent(items.map((i) => i.colors)) ?? FALLBACK_ACCENT;
    await db.settings.put({ key: 'accent', value: accent });
  } catch (e) {
    console.error('accent recompute', e);
  }
}

const GROUND = { light: '#fafaf7', dark: '#1c1b19' };

/** Push --accent / --accent-soft onto :root, lightness-adjusted until the
 * sampled color passes 4.5:1 against the active ground (§2 rule 7). */
export function applyAccent(hex: string, dark: boolean) {
  const adjusted = adjustForContrast(hex, dark ? GROUND.dark : GROUND.light);
  const [r, g, b] = hexToRgb(adjusted);
  const root = document.documentElement.style;
  root.setProperty('--accent', adjusted);
  root.setProperty('--accent-soft', `rgba(${r},${g},${b},0.12)`);
}
