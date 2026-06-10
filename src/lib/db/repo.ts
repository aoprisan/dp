import { nanoid } from 'nanoid';
import { db, type CalendarEntry, type Item, type Look, type Photo, type Trip } from './schema';
import { recomputeAccent } from '$lib/stores/accent';

export const newId = () => nanoid(10);

// ---- items ----

export type ItemDraft = Omit<Item, 'id' | 'createdAt' | 'updatedAt'>;

export async function addItem(draft: ItemDraft, photos: { blob: Blob; thumb: Blob }[]): Promise<string> {
  const now = Date.now();
  const id = newId();
  await db.transaction('rw', db.items, db.photos, async () => {
    await db.items.add({ ...draft, id, createdAt: now, updatedAt: now });
    await db.photos.bulkAdd(
      photos.map((p, i) => ({ id: newId(), itemId: id, blob: p.blob, thumb: p.thumb, isMain: i === 0, order: i })),
    );
  });
  void recomputeAccent();
  return id;
}

export async function updateItem(id: string, patch: Partial<Item>) {
  await db.items.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteItem(id: string) {
  await db.transaction('rw', [db.items, db.photos, db.wears, db.looks, db.calendar, db.trips], async () => {
    await db.items.delete(id);
    await db.photos.where('itemId').equals(id).delete();
    await db.wears.where('itemId').equals(id).delete();
    const strip = (ids: string[]) => ids.filter((x) => x !== id);
    await db.looks.toCollection().modify((l: Look) => {
      if (l.itemIds.includes(id)) l.itemIds = strip(l.itemIds);
    });
    await db.calendar.toCollection().modify((c: CalendarEntry) => {
      if (c.itemIds.includes(id)) c.itemIds = strip(c.itemIds);
    });
    await db.trips.toCollection().modify((t: Trip) => {
      if (t.itemIds.includes(id) || t.packed.includes(id)) {
        t.itemIds = strip(t.itemIds);
        t.packed = strip(t.packed);
      }
    });
  });
  void recomputeAccent();
}

export async function addPhotos(itemId: string, photos: { blob: Blob; thumb: Blob }[]) {
  const existing = await db.photos.where('itemId').equals(itemId).count();
  await db.photos.bulkAdd(
    photos.map((p, i) => ({
      id: newId(),
      itemId,
      blob: p.blob,
      thumb: p.thumb,
      isMain: existing === 0 && i === 0,
      order: existing + i,
    })),
  );
}

export async function deletePhoto(id: string) {
  const photo = await db.photos.get(id);
  if (!photo) return;
  await db.photos.delete(id);
  if (photo.isMain) {
    const next = await db.photos.where('itemId').equals(photo.itemId).sortBy('order');
    if (next[0]) await db.photos.update(next[0].id, { isMain: true });
  }
}

export async function setMainPhoto(id: string) {
  const photo = await db.photos.get(id);
  if (!photo) return;
  await db.photos
    .where('itemId')
    .equals(photo.itemId)
    .modify((p: Photo) => {
      p.isMain = p.id === id;
    });
}

export async function replacePhotoBlob(id: string, blob: Blob, thumb: Blob) {
  await db.photos.update(id, { blob, thumb });
}

// ---- tags ----

export async function ensureTag(name: string): Promise<string> {
  const trimmed = name.trim();
  const existing = await db.tags.where('name').equalsIgnoreCase(trimmed).first();
  if (existing) return existing.id;
  const id = newId();
  await db.tags.add({ id, name: trimmed });
  return id;
}

// ---- looks ----

export async function addLook(title: string, itemIds: string[], coverPhotoId?: string): Promise<string> {
  const now = Date.now();
  const id = newId();
  await db.looks.add({ id, title, itemIds, coverPhotoId, createdAt: now, updatedAt: now });
  return id;
}

export async function updateLook(id: string, patch: Partial<Look>) {
  await db.looks.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteLook(id: string) {
  await db.transaction('rw', db.looks, db.calendar, async () => {
    await db.looks.delete(id);
    await db.calendar
      .where('lookId')
      .equals(id)
      .modify((c: CalendarEntry) => {
        delete c.lookId;
      });
  });
}

// ---- calendar & wear ----

export async function scheduleEntry(date: string, lookId: string | undefined, itemIds: string[]): Promise<string> {
  const id = newId();
  await db.calendar.add({ id, date, lookId, itemIds, worn: false });
  return id;
}

/** Resolve an entry's full item set (look items + extras). */
export async function entryItemIds(entry: CalendarEntry): Promise<string[]> {
  const ids = new Set(entry.itemIds);
  if (entry.lookId) {
    const look = await db.looks.get(entry.lookId);
    look?.itemIds.forEach((i) => ids.add(i));
  }
  return [...ids];
}

/** Mark a calendar entry worn — writes one wear row per item (P3). */
export async function markWorn(entryId: string) {
  const entry = await db.calendar.get(entryId);
  if (!entry || entry.worn) return;
  const ids = await entryItemIds(entry);
  await db.transaction('rw', db.calendar, db.wears, db.looks, async () => {
    await db.calendar.update(entryId, { worn: true });
    await db.wears.bulkAdd(ids.map((itemId) => ({ id: newId(), itemId, lookId: entry.lookId, date: entry.date })));
  });
}

export async function unmarkWorn(entryId: string) {
  const entry = await db.calendar.get(entryId);
  if (!entry || !entry.worn) return;
  const ids = new Set(await entryItemIds(entry));
  await db.transaction('rw', db.calendar, db.wears, db.looks, async () => {
    await db.calendar.update(entryId, { worn: false });
    await db.wears
      .where('date')
      .equals(entry.date)
      .filter((w) => ids.has(w.itemId) && w.lookId === entry.lookId)
      .delete();
  });
}

/** "Wore again" shortcut on an item — one wear today, no calendar entry. */
export async function woreToday(itemId: string) {
  await db.wears.add({ id: newId(), itemId, date: todayStr() });
}

// ---- trips ----

export async function addTrip(draft: Omit<Trip, 'id'>): Promise<string> {
  const id = newId();
  await db.trips.add({ ...draft, id });
  return id;
}

// ---- settings ----

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key);
  return row?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}

// ---- shared formatting (all data is mono, §2) ----

export function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fmtMoney(cents: number): string {
  const eur = cents / 100;
  return eur >= 10 ? `€${Math.round(eur)}` : `€${eur.toFixed(eur % 1 === 0 ? 0 : 2)}`;
}

export function costPerWear(price: number | undefined, wearCount: number): number | undefined {
  if (price == null) return undefined;
  return price / Math.max(1, wearCount);
}
