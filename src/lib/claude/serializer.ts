import type { Item, Tag, Trip, Wear } from '$lib/db/schema';
import { colorName } from '$lib/images/color';
import { fmtMoney, todayStr } from '$lib/db/repo';
import type { DayForecast, Forecast } from '$lib/weather/openMeteo';
import { wmoLabel } from '$lib/weather/openMeteo';

export interface ClosetSnapshot {
  items: Item[]; // ordered by createdAt — index positions are the #ids
  wearCounts: Map<string, number>;
  lastWorn: Map<string, string>;
  tagNames: Map<string, string>;
}

export function buildSnapshot(items: Item[], wears: Wear[], tags: Tag[]): ClosetSnapshot {
  const ordered = [...items].sort((a, b) => a.createdAt - b.createdAt);
  const wearCounts = new Map<string, number>();
  const lastWorn = new Map<string, string>();
  for (const w of wears) {
    wearCounts.set(w.itemId, (wearCounts.get(w.itemId) ?? 0) + 1);
    const prev = lastWorn.get(w.itemId);
    if (!prev || w.date > prev) lastWorn.set(w.itemId, w.date);
  }
  return { items: ordered, wearCounts, lastWorn, tagNames: new Map(tags.map((t) => [t.id, t.name])) };
}

export function itemRef(snap: ClosetSnapshot, itemId: string): string {
  const i = snap.items.findIndex((it) => it.id === itemId);
  return `#${String(i + 1).padStart(3, '0')}`;
}

/** Compact line per item, ~15 tokens (§5):
 * `#012 Linen shirt — top · white/beige · warmth 2/5 · formality 2/5 · worn 12× · last 2026-05-28 · €40 · tags: summer, basics` */
export function serializeItem(snap: ClosetSnapshot, item: Item): string {
  const parts: string[] = [];
  parts.push(`${itemRef(snap, item.id)} ${item.title} — ${item.category}`);
  if (item.colors.length) parts.push(item.colors.map(colorName).join('/'));
  parts.push(`warmth ${item.warmth}/5`, `formality ${item.formality}/5`);
  const worn = snap.wearCounts.get(item.id) ?? 0;
  parts.push(`worn ${worn}×`);
  const last = snap.lastWorn.get(item.id);
  if (last) parts.push(`last ${last}`);
  if (item.price != null) parts.push(fmtMoney(item.price));
  if (item.brand) parts.push(item.brand);
  const tags = item.tagIds.map((t) => snap.tagNames.get(t)).filter(Boolean);
  if (tags.length) parts.push(`tags: ${tags.join(', ')}`);
  if (item.archived) parts.push('ARCHIVED');
  return parts.join(' · ');
}

export function serializeItems(snap: ClosetSnapshot, filter?: (i: Item) => boolean): string {
  return snap.items
    .filter(filter ?? ((i) => !i.archived))
    .map((i) => serializeItem(snap, i))
    .join('\n');
}

export function forecastTable(days: DayForecast[]): string {
  return days
    .map(
      (d) =>
        `  ${d.date}  ${Math.round(d.tMin)}–${Math.round(d.tMax)}°C  ${wmoLabel(d.code)}` +
        (d.precipProb >= 20 ? `  rain ${Math.round(d.precipProb)}%` : ''),
    )
    .join('\n');
}

export function headerBlock(opts: { location?: string; forecast?: Forecast; closetSize: number }): string {
  const lines = [`Today: ${todayStr()}`];
  if (opts.location) lines.push(`Location: ${opts.location}`);
  if (opts.forecast?.days.length) lines.push(`7-day forecast:\n${forecastTable(opts.forecast.days.slice(0, 7))}`);
  lines.push(`Closet: ${opts.closetSize} items`);
  return lines.join('\n');
}

/** Full export for the attach-to-chat workflow (§5). */
export function exportMarkdown(snap: ClosetSnapshot): string {
  return `# My closet — ${todayStr()}\n\n${serializeItems(snap, () => true)}\n`;
}

export function exportJson(snap: ClosetSnapshot): string {
  return JSON.stringify(
    snap.items.map((i) => ({
      ref: itemRef(snap, i.id),
      title: i.title,
      category: i.category,
      brand: i.brand,
      priceCents: i.price,
      colors: i.colors.map(colorName),
      warmth: i.warmth,
      formality: i.formality,
      wearCount: snap.wearCounts.get(i.id) ?? 0,
      lastWorn: snap.lastWorn.get(i.id),
      tags: i.tagIds.map((t) => snap.tagNames.get(t)).filter(Boolean),
      archived: i.archived,
      notes: i.notes,
    })),
    null,
    1,
  );
}

// ---- prompt templates (§5) ----

export interface AssistantCtx {
  snap: ClosetSnapshot;
  location?: string;
  forecast?: Forecast;
  /** stylist: dates to plan, with what's already scheduled */
  dates?: { date: string; planned?: string }[];
  /** packing */
  trip?: Trip;
  tripForecast?: DayForecast[];
  /** shopping */
  candidate?: string;
  /** category filter applied before generating (>150 item guard) */
  categories?: string[];
}

export interface PromptTemplate {
  id: 'stylist' | 'packing' | 'audit' | 'shopping';
  title: string;
  blurb: string;
  build(ctx: AssistantCtx): string;
}

export function filteredItems(ctx: AssistantCtx, includeArchived = false): (i: Item) => boolean {
  return (i) =>
    (includeArchived || !i.archived) && (!ctx.categories?.length || ctx.categories.includes(i.category));
}
