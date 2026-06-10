import { db, uid } from './db';
import { compressPhoto } from './photo';
import type { Item, Photo, Tag, Privacy } from './types';

const urlCache = new Map<string, string>();

function pruneURLCache(items: Item[], draftPhotos: Photo[]) {
  const live = new Set<string>();
  for (const item of items) for (const p of item.photos) live.add(p.id);
  for (const p of draftPhotos) live.add(p.id);
  for (const [id, url] of urlCache) {
    if (!live.has(id)) {
      URL.revokeObjectURL(url);
      urlCache.delete(id);
    }
  }
}

export function photoURL(photo: Photo): string {
  if (!urlCache.has(photo.id)) {
    urlCache.set(photo.id, URL.createObjectURL(photo.blob));
  }
  return urlCache.get(photo.id)!;
}

class WardrobeStore {
  items = $state<Item[]>([]);
  tags = $state<Tag[]>([]);
  scope = $state<'all' | Privacy>('all');
  selectedTags = $state(new Set<string>());

  editingId = $state<string | null>(null);
  draftPhotos = $state<Photo[]>([]);
  draftTagIds = $state(new Set<string>());

  visible = $derived(
    this.items.filter((item) => {
      if (this.scope !== 'all' && item.privacy !== this.scope) return false;
      for (const t of this.selectedTags) if (!item.tags.includes(t)) return false;
      return true;
    })
  );

  async init() {
    const [items, tags] = await Promise.all([db.getAllItems(), db.getAllTags()]);
    this.items = items.sort((a, b) => b.createdAt - a.createdAt);
    this.tags = tags.sort((a, b) => a.name.localeCompare(b.name));
  }

  setScope(s: 'all' | Privacy) {
    this.scope = s;
  }

  toggleTag(tagId: string) {
    const next = new Set(this.selectedTags);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    this.selectedTags = next;
  }

  openEditor(item?: Item) {
    this.editingId = item?.id ?? null;
    this.draftPhotos = item ? [...item.photos] : [];
    this.draftTagIds = new Set(item?.tags ?? []);
  }

  closeEditor() {
    this.draftPhotos = [];
    pruneURLCache(this.items, []);
  }

  toggleDraftTag(tagId: string) {
    const next = new Set(this.draftTagIds);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    this.draftTagIds = next;
  }

  async createTag(name: string): Promise<Tag> {
    name = name.trim().toLowerCase().replace(/^#/, '');
    if (!name) throw new Error('Empty tag name');
    let tag = this.tags.find((t) => t.name === name);
    if (!tag) {
      tag = { id: uid(), name };
      await db.putTag(tag);
      this.tags = [...this.tags, tag].sort((a, b) => a.name.localeCompare(b.name));
    }
    return tag;
  }

  async addDraftPhotos(files: FileList | File[]) {
    for (const file of [...files].filter((f) => f.type.startsWith('image/'))) {
      this.draftPhotos = [...this.draftPhotos, await compressPhoto(file)];
    }
  }

  removeDraftPhoto(index: number) {
    this.draftPhotos = this.draftPhotos.filter((_, i) => i !== index);
  }

  setCoverPhoto(index: number) {
    const next = [...this.draftPhotos];
    next.unshift(...next.splice(index, 1));
    this.draftPhotos = next;
  }

  async saveItem(data: { title: string; description: string; privacy: Privacy }): Promise<Item> {
    const patch = {
      ...data,
      tags: [...this.draftTagIds],
      photos: $state.snapshot(this.draftPhotos) as Photo[],
      updatedAt: Date.now(),
    };

    if (this.editingId) {
      const existing = this.items.find((it) => it.id === this.editingId);
      if (!existing) throw new Error('Item not found');
      const updated = $state.snapshot({ ...existing, ...patch }) as Item;
      await db.putItem(updated);
      this.items = this.items.map((it) => (it.id === this.editingId ? updated : it));
      pruneURLCache(this.items, []);
      return updated;
    }

    const item = $state.snapshot({
      id: uid(),
      no: await db.nextPieceNumber(),
      createdAt: Date.now(),
      ...patch,
    }) as Item;
    await db.putItem(item);
    this.items = [item, ...this.items];
    return item;
  }

  async deleteItem(id: string) {
    await db.deleteItem(id);
    this.items = this.items.filter((it) => it.id !== id);
    pruneURLCache(this.items, []);
  }

  getItem(id: string): Item | undefined {
    return this.items.find((it) => it.id === id);
  }

  get editingItem(): Item | undefined {
    return this.editingId ? this.getItem(this.editingId) : undefined;
  }
}

export const wardrobe = new WardrobeStore();
