import { addItem, addLook, ensureTag, newId, scheduleEntry } from './db/repo';
import { db } from './db/schema';
import type { Category, Scale } from './db/schema';

async function fetchPhoto(lock: number): Promise<{ blob: Blob; thumb: Blob }> {
  const url = `${import.meta.env.BASE_URL}seed/${lock}.jpg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  const blob = await res.blob();
  const thumb = await canvasResize(blob, 240, 320);
  return { blob, thumb };
}

function canvasResize(blob: Blob, maxW: number, maxH: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      c.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
        'image/jpeg',
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('image load failed'));
    };
    img.src = objectUrl;
  });
}

/** Returns a YYYY-MM-DD string for N days before 2026-06-10. */
function ago(days: number): string {
  const d = new Date(Date.UTC(2026, 5, 10));
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Future date offset from 2026-06-10. */
function ahead(days: number): string {
  const d = new Date(Date.UTC(2026, 5, 10));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Generate [count] dates spaced [interval] days apart going backward. */
function every(interval: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => ago((i + 1) * interval));
}

type ItemDef = {
  title: string;
  category: Category;
  brand?: string;
  price?: number; // euros — converted to cents in addItem
  colors: string[];
  warmth: Scale;
  formality: Scale;
  tagNames: string[];
  imgLock: number;
  wearDates: string[];
};

const ITEMS: ItemDef[] = [
  // ── TOPS ──────────────────────────────────────────────────────────────
  {
    title: 'White Linen Shirt',
    category: 'top', brand: 'Uniqlo', price: 40,
    colors: ['#f5f0e8'],
    warmth: 2, formality: 3,
    tagNames: ['summer', 'work'],
    imgLock: 11,
    wearDates: every(7, 12),
  },
  {
    title: 'Navy Breton Stripe Tee',
    category: 'top', brand: 'Saint James', price: 120,
    colors: ['#1c2b4b', '#f0ece0'],
    warmth: 2, formality: 2,
    tagNames: ['casual', 'navy'],
    imgLock: 12,
    wearDates: every(8, 10),
  },
  {
    title: 'Black Merino Turtleneck',
    category: 'top', brand: 'COS', price: 90,
    colors: ['#1a1a1a'],
    warmth: 4, formality: 3,
    tagNames: ['winter', 'layering'],
    imgLock: 13,
    wearDates: [ago(101), ago(117), ago(126), ago(140), ago(155)],
  },
  {
    title: 'Grey Oversized Hoodie',
    category: 'top', brand: 'Arket', price: 75,
    colors: ['#8a8a8a'],
    warmth: 3, formality: 1,
    tagNames: ['casual', 'lounge'],
    imgLock: 14,
    wearDates: every(3, 28),
  },
  {
    title: 'White Oxford Button-Down',
    category: 'top', brand: 'NN07', price: 130,
    colors: ['#f8f8f8'],
    warmth: 2, formality: 4,
    tagNames: ['work', 'summer'],
    imgLock: 15,
    wearDates: every(6, 18),
  },
  {
    title: 'Olive Linen Tee',
    category: 'top', brand: 'Muji', price: 25,
    colors: ['#6b7c3e'],
    warmth: 1, formality: 1,
    tagNames: ['summer', 'casual'],
    imgLock: 16,
    wearDates: every(4, 20),
  },
  // ── BOTTOMS ───────────────────────────────────────────────────────────
  {
    title: 'Dark Wash Slim Jeans',
    category: 'bottom', brand: 'Nudie Jeans', price: 180,
    colors: ['#1c2b4b'],
    warmth: 2, formality: 2,
    tagNames: ['everyday', 'denim'],
    imgLock: 21,
    wearDates: every(3, 32),
  },
  {
    title: 'Camel Wool Trousers',
    category: 'bottom', brand: 'Arket', price: 150,
    colors: ['#c4a270'],
    warmth: 4, formality: 4,
    tagNames: ['work', 'winter'],
    imgLock: 22,
    wearDates: [ago(88), ago(102), ago(117), ago(131), ago(145), ago(160)],
  },
  {
    title: 'Ecru Linen Shorts',
    category: 'bottom', brand: '& Other Stories', price: 60,
    colors: ['#f0ece0'],
    warmth: 1, formality: 2,
    tagNames: ['summer'],
    imgLock: 23,
    wearDates: every(5, 10),
  },
  // ── DRESSES ───────────────────────────────────────────────────────────
  {
    title: 'Black Midi Wrap Dress',
    category: 'dress', brand: 'Reformation', price: 220,
    colors: ['#1a1a1a'],
    warmth: 2, formality: 4,
    tagNames: ['dinner', 'versatile'],
    imgLock: 31,
    wearDates: [ago(11), ago(53), ago(74), ago(117)],
  },
  {
    title: 'Terracotta Slip Dress',
    category: 'dress', brand: 'Sezane', price: 180,
    colors: ['#c4603a'],
    warmth: 1, formality: 3,
    tagNames: ['summer', 'dinner'],
    imgLock: 32,
    wearDates: every(10, 8),
  },
  // ── OUTERWEAR ─────────────────────────────────────────────────────────
  {
    title: 'Camel Trench Coat',
    category: 'outerwear', brand: 'A.P.C.', price: 420,
    colors: ['#c4a270'],
    warmth: 3, formality: 4,
    tagNames: ['spring', 'work'],
    imgLock: 41,
    wearDates: every(9, 10),
  },
  {
    title: 'Black Leather Jacket',
    category: 'outerwear', brand: 'All Saints', price: 350,
    colors: ['#1a1a1a'],
    warmth: 2, formality: 2,
    tagNames: ['rock', 'evening'],
    imgLock: 42,
    wearDates: every(11, 9),
  },
  {
    title: 'Navy Quilted Vest',
    category: 'outerwear', brand: 'Barbour', price: 160,
    colors: ['#1c2b4b'],
    warmth: 3, formality: 2,
    tagNames: ['weekend', 'layering'],
    imgLock: 43,
    wearDates: [ago(92), ago(106), ago(120), ago(138)],
  },
  // ── SHOES ─────────────────────────────────────────────────────────────
  {
    title: 'White Low-Top Sneakers',
    category: 'shoes', brand: 'Common Projects', price: 380,
    colors: ['#f8f8f8'],
    warmth: 1, formality: 2,
    tagNames: ['everyday'],
    imgLock: 51,
    wearDates: every(3, 35),
  },
  {
    title: 'Tan Leather Loafers',
    category: 'shoes', brand: 'Mango', price: 90,
    colors: ['#c4955a'],
    warmth: 2, formality: 3,
    tagNames: ['work', 'versatile'],
    imgLock: 52,
    wearDates: every(6, 15),
  },
  {
    title: 'Black Chelsea Boots',
    category: 'shoes', brand: 'Dr. Martens', price: 170,
    colors: ['#1a1a1a'],
    warmth: 3, formality: 3,
    tagNames: ['autumn', 'versatile'],
    imgLock: 53,
    wearDates: [ago(51), ago(62), ago(76), ago(90), ago(101), ago(116), ago(126), ago(147)],
  },
  // ── BAGS ──────────────────────────────────────────────────────────────
  {
    title: 'Black Mini Shoulder Bag',
    category: 'bag', brand: 'Polene', price: 280,
    colors: ['#1a1a1a'],
    warmth: 1, formality: 3,
    tagNames: ['everyday'],
    imgLock: 61,
    wearDates: every(4, 25),
  },
  {
    title: 'Natural Leather Tote',
    category: 'bag', brand: 'Cuyana', price: 195,
    colors: ['#c4955a'],
    warmth: 1, formality: 2,
    tagNames: ['work'],
    imgLock: 62,
    wearDates: every(7, 14),
  },
  // ── ACCESSORIES ───────────────────────────────────────────────────────
  {
    title: 'Ivory Cashmere Scarf',
    category: 'accessory', brand: 'Johnstons of Elgin', price: 190,
    colors: ['#f0ece0'],
    warmth: 4, formality: 3,
    tagNames: ['winter', 'layering'],
    imgLock: 71,
    wearDates: [ago(97), ago(111), ago(128), ago(140), ago(157)],
  },
  {
    title: 'Gold Stacking Rings',
    category: 'accessory', brand: 'Missoma', price: 80,
    colors: ['#c9a227'],
    warmth: 1, formality: 3,
    tagNames: ['everyday'],
    imgLock: 72,
    wearDates: every(2, 40),
  },
];

// Looks defined as indices into ITEMS array (same order as above)
const LOOKS = [
  {
    title: 'Weekend Brunch',
    indices: [1, 6, 14, 17], // Breton + Jeans + Sneakers + Mini Bag
  },
  {
    title: 'Office Classic',
    indices: [4, 7, 15, 18], // Oxford + Camel Trousers + Loafers + Tote
  },
  {
    title: 'Summer Evening',
    indices: [10, 12, 16, 17], // Terracotta Slip + Leather Jacket + Chelsea + Mini Bag
  },
  {
    title: 'Sunny Saturday',
    indices: [5, 8, 14], // Olive Tee + Linen Shorts + Sneakers
  },
  {
    title: 'Winter Office',
    indices: [2, 7, 16, 19], // Turtleneck + Camel Trousers + Chelsea + Cashmere Scarf
  },
];

export async function seedDatabase(onProgress?: (msg: string) => void) {
  const log = (msg: string) => {
    console.log(msg);
    onProgress?.(msg);
  };

  log('Clearing existing data…');
  await db.transaction(
    'rw',
    [db.items, db.photos, db.tags, db.looks, db.calendar, db.wears, db.trips],
    async () => {
      await Promise.all([
        db.items.clear(),
        db.photos.clear(),
        db.tags.clear(),
        db.looks.clear(),
        db.calendar.clear(),
        db.wears.clear(),
        db.trips.clear(),
      ]);
    },
  );

  log('Creating tags…');
  const allTagNames = [...new Set(ITEMS.flatMap((i) => i.tagNames))];
  const tagMap: Record<string, string> = {};
  for (const name of allTagNames) {
    tagMap[name] = await ensureTag(name);
  }

  log(`Adding ${ITEMS.length} items (fetching photos from loremflickr…)`);
  const itemIds: string[] = [];
  for (let i = 0; i < ITEMS.length; i++) {
    const def = ITEMS[i];
    log(`  [${i + 1}/${ITEMS.length}] ${def.title}`);
    const photo = await fetchPhoto(def.imgLock);
    const id = await addItem(
      {
        title: def.title,
        category: def.category,
        brand: def.brand,
        price: def.price != null ? Math.round(def.price * 100) : undefined,
        colors: def.colors,
        warmth: def.warmth,
        formality: def.formality,
        tagIds: def.tagNames.map((n) => tagMap[n]),
        archived: false,
      },
      [photo],
    );
    itemIds.push(id);
  }

  log('Writing wear history…');
  const wearRows = ITEMS.flatMap((def, i) =>
    def.wearDates.map((date) => ({ id: newId(), itemId: itemIds[i], date })),
  );
  await db.wears.bulkAdd(wearRows);

  log('Creating looks…');
  const lookIds: string[] = [];
  for (const look of LOOKS) {
    const id = await addLook(
      look.title,
      look.indices.map((idx) => itemIds[idx]),
    );
    lookIds.push(id);
  }

  log('Adding calendar entries…');
  // Past entry (worn yesterday)
  const pastEntryId = await scheduleEntry(ago(1), lookIds[3], []); // Sunny Saturday
  await db.calendar.update(pastEntryId, { worn: true });
  await db.wears.bulkAdd(
    LOOKS[3].indices.map((idx) => ({ id: newId(), itemId: itemIds[idx], date: ago(1), lookId: lookIds[3] })),
  );

  // Upcoming entries
  await scheduleEntry(ahead(1), lookIds[0], []); // Weekend Brunch
  await scheduleEntry(ahead(3), lookIds[1], []); // Office Classic
  await scheduleEntry(ahead(6), lookIds[2], []); // Summer Evening

  log('Adding a sample trip…');
  await db.trips.add({
    id: newId(),
    title: 'Barcelona Long Weekend',
    place: 'Barcelona, Spain',
    lat: 41.3851,
    lon: 2.1734,
    start: ahead(14),
    end: ahead(17),
    itemIds: [0, 1, 5, 8, 9, 10, 14, 17, 20].map((i) => itemIds[i]),
    packed: [],
  });

  log(`Done! Created ${itemIds.length} items, ${wearRows.length} wear records, ${lookIds.length} looks.`);
  return { itemCount: itemIds.length, wearCount: wearRows.length, lookCount: lookIds.length };
}
