import type { Item } from '$lib/db/schema';
import { rgbToHsl, hexToRgb } from '$lib/images/color';
import type { DayForecast } from '$lib/weather/openMeteo';

export interface ScoreParts {
  warmth: number;
  formality: number;
  color: number;
  completeness: number;
}

export interface OutfitSuggestion {
  items: Item[];
  score: number;
  parts: ScoreParts;
}

/** Map a day's average temp (°C) to the 1–5 warmth scale items use. */
export function targetWarmth(day: DayForecast): number {
  const avg = (day.tMax + day.tMin) / 2;
  if (avg >= 24) return 1;
  if (avg >= 18) return 2;
  if (avg >= 11) return 3;
  if (avg >= 4) return 4;
  return 5;
}

function outfitWarmth(items: Item[]): number {
  // outerwear contributes double — it is the warmth lever
  let sum = 0,
    w = 0;
  for (const it of items) {
    if (it.category === 'bag' || it.category === 'accessory') continue;
    const weight = it.category === 'outerwear' ? 2 : 1;
    sum += it.warmth * weight;
    w += weight;
  }
  return w ? sum / w : 3;
}

function warmthScore(items: Item[], target: number): number {
  return Math.max(0, 1 - Math.abs(outfitWarmth(items) - target) / 4);
}

function formalityScore(items: Item[]): number {
  const f = items
    .filter((i) => i.category !== 'bag' && i.category !== 'accessory')
    .map((i) => i.formality);
  if (f.length < 2) return 1;
  return Math.max(0, 1 - (Math.max(...f) - Math.min(...f)) / 4);
}

function isNeutral(hex: string): boolean {
  const [, s, l] = rgbToHsl(...hexToRgb(hex));
  return s < 0.18 || l < 0.12 || l > 0.9;
}

function huePairScore(a: string, b: string): number {
  if (isNeutral(a) || isNeutral(b)) return 1;
  const [ha] = rgbToHsl(...hexToRgb(a));
  const [hb] = rgbToHsl(...hexToRgb(b));
  let d = Math.abs(ha - hb);
  if (d > 180) d = 360 - d;
  if (d <= 35) return 1; // analogous / same family
  if (d >= 150) return 0.85; // complementary tension — works
  if (d <= 70) return 0.6;
  return 0.35; // awkward middle distance
}

function colorScore(items: Item[]): number {
  const primaries = items.map((i) => i.colors[0]).filter(Boolean);
  if (primaries.length < 2) return 1;
  let sum = 0,
    n = 0;
  for (let i = 0; i < primaries.length; i++)
    for (let j = i + 1; j < primaries.length; j++) {
      sum += huePairScore(primaries[i], primaries[j]);
      n++;
    }
  return n ? sum / n : 1;
}

function completenessScore(items: Item[], cold: boolean): number {
  const cats = new Set(items.map((i) => i.category));
  const core = cats.has('dress') ? cats.has('shoes') : cats.has('top') && cats.has('bottom') && cats.has('shoes');
  let s = core ? 0.7 : 0.2;
  if (!cold || cats.has('outerwear')) s += 0.15;
  if (cats.has('bag') || cats.has('accessory')) s += 0.15;
  return Math.min(1, s);
}

function scoreOutfit(items: Item[], target: number): { score: number; parts: ScoreParts } {
  const parts: ScoreParts = {
    warmth: warmthScore(items, target),
    formality: formalityScore(items),
    color: colorScore(items),
    completeness: completenessScore(items, target >= 3.5),
  };
  const score =
    parts.warmth * 0.35 + parts.formality * 0.25 + parts.color * 0.25 + parts.completeness * 0.15;
  return { score, parts };
}

function topByWarmthFit(items: Item[], target: number, n: number): Item[] {
  return [...items].sort((a, b) => Math.abs(a.warmth - target) - Math.abs(b.warmth - target)).slice(0, n);
}

/** Rank outfit candidates for a forecast day. Pure TS, runs offline (§P5). */
export function suggestOutfits(allItems: Item[], day: DayForecast, limit = 6): OutfitSuggestion[] {
  const active = allItems.filter((i) => !i.archived);
  const target = targetWarmth(day);
  const cold = target >= 3.5;
  const by = (c: Item['category']) => active.filter((i) => i.category === c);

  const tops = topByWarmthFit(by('top'), target, 6);
  const bottoms = topByWarmthFit(by('bottom'), target, 6);
  const dresses = topByWarmthFit(by('dress'), target, 5);
  const shoes = topByWarmthFit(by('shoes'), target, 4);
  const outer = topByWarmthFit(by('outerwear'), target, 3);

  const bases: Item[][] = [];
  for (const t of tops) for (const b of bottoms) bases.push([t, b]);
  for (const d of dresses) bases.push([d]);

  const candidates: Item[][] = [];
  for (const base of bases) {
    const withShoes = shoes.length ? shoes.map((s) => [...base, s]) : [base];
    for (const ws of withShoes) {
      candidates.push(ws);
      if (cold) for (const o of outer) candidates.push([...ws, o]);
    }
  }

  const scored = candidates.map((items) => ({ items, ...scoreOutfit(items, target) }));
  scored.sort((a, b) => b.score - a.score);

  // diversify: don't let one hero item dominate the whole list
  const picked: OutfitSuggestion[] = [];
  const usage = new Map<string, number>();
  for (const s of scored) {
    if (picked.length >= limit) break;
    if (s.items.some((i) => (usage.get(i.id) ?? 0) >= 2)) continue;
    picked.push(s);
    s.items.forEach((i) => usage.set(i.id, (usage.get(i.id) ?? 0) + 1));
  }
  return picked;
}
