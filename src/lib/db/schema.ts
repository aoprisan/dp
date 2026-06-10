import Dexie, { type Table } from 'dexie';

export const CATEGORIES = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'bag', 'accessory'] as const;
export type Category = (typeof CATEGORIES)[number];
export type Scale = 1 | 2 | 3 | 4 | 5;

export interface Item {
  id: string; // nanoid
  title: string;
  category: Category;
  brand?: string;
  price?: number; // cents
  colors: string[]; // hex, extracted at upload (max 3)
  warmth: Scale;
  formality: Scale;
  notes?: string;
  tagIds: string[];
  archived: boolean; // sell/donate pile, excluded from suggestions
  createdAt: number;
  updatedAt: number;
}
export interface Photo {
  id: string;
  itemId: string;
  blob: Blob;
  thumb: Blob;
  isMain: boolean;
  order: number;
}
export interface Tag {
  id: string;
  name: string;
}
export interface Look {
  id: string;
  title: string;
  itemIds: string[];
  coverPhotoId?: string;
  createdAt: number;
  updatedAt: number;
}
export interface CalendarEntry {
  id: string;
  date: string; // YYYY-MM-DD
  lookId?: string;
  itemIds: string[];
  worn: boolean;
}
export interface Wear {
  id: string;
  itemId: string;
  lookId?: string;
  date: string;
}
export interface Trip {
  id: string;
  title: string;
  place: string;
  lat: number;
  lon: number;
  start: string;
  end: string;
  itemIds: string[];
  packed: string[];
}
export interface Setting {
  key: string;
  value: unknown;
} // location, accent, units, theme

export class DPDB extends Dexie {
  items!: Table<Item>;
  photos!: Table<Photo>;
  tags!: Table<Tag>;
  looks!: Table<Look>;
  calendar!: Table<CalendarEntry>;
  wears!: Table<Wear>;
  trips!: Table<Trip>;
  settings!: Table<Setting>;
  constructor() {
    super('dresspanic');
    this.version(1).stores({
      items: 'id, category, archived, *tagIds, updatedAt',
      photos: 'id, itemId, isMain',
      tags: 'id, name',
      looks: 'id, updatedAt',
      calendar: 'id, date, lookId',
      wears: 'id, itemId, date',
      trips: 'id, start',
      settings: 'key',
    });
  }
}

export const db = new DPDB();
