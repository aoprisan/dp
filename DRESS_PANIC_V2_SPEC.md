# Dress Panic v2 — Build Spec

Single source of truth for the fresh rebuild. Drop this in the repo root and build phase by phase.

**What it is**: Offline-first wardrobe PWA. Catalog clothes, build outfits, plan on a calendar, track wear & cost-per-wear, get weather-aware suggestions — and generate rich prompts the user pastes into their own Claude app (zero AI API costs).

**What it is NOT (v1 cut list)**: no accounts/auth, no backend, no social (feed/follows/comments/reposts), no voting/badges/leaderboard, no affiliates, no paid API services. Schema stays sync-ready for later.

---

## 1. Stack

| Concern | Choice |
|---|---|
| Framework | SvelteKit 2 + `adapter-static`, TypeScript |
| Styling | TailwindCSS 4 (tokens in §2) |
| Data | Dexie 4 (IndexedDB), reactive via `liveQuery` |
| Photos | Compressed WebP blobs in IndexedDB (`browser-image-compression`, max 1200px / ~200KB) |
| Bg removal | `@imgly/background-removal` (WASM, on-device, lazy-loaded) |
| Color extraction | Sample dominant colors at upload (e.g. `node-vibrant` or median-cut on canvas) |
| Weather | Open-Meteo forecast + geocoding APIs — **no API key needed** |
| PWA | `vite-plugin-pwa`, precache shell, runtime-cache weather |
| Backup | Zip (data.json + photo blobs) via File System Access API, `fflate` |

```
src/
├── lib/
│   ├── db/            schema.ts · repo functions per table
│   ├── images/        compress.ts · bgRemove.ts · palette.ts
│   ├── weather/       openMeteo.ts (forecast + geocode + cache)
│   ├── claude/        serializer.ts · prompts/ (stylist, packing, audit, shopping)
│   ├── suggest/       scoring.ts (warmth, formality, color, completeness)
│   ├── components/
│   └── stores/        settings.ts · accent.ts
└── routes/
    ├── closet/  looks/  calendar/  stats/  trips/  assistant/  settings/
```

---

## 2. Design system — "Gallery"

Principle: the clothes are the content; the UI is a quiet gallery. Ink-on-paper chrome, no decorative color. The single accent color is **sampled from the user's own wardrobe** (dominant color across item photos, recomputed on add/delete, stored in `settings`). Fallback accent before first item: `#185FA5`.

### Tokens

```js
// tailwind.config — theme.extend
colors: {
  ground:  '#FAFAF7',   // app background (dark: '#1C1B19')
  tile:    '#EFEDE6',   // item tile / surface (dark: '#26251F')
  tile2:   '#E5E2D8',   // pressed / nested surface (dark: '#2E2C26')
  ink:     '#1F1E1B',   // primary text (dark: '#F2F0EA')
  ink2:    '#5F5E5A',   // secondary text (dark: '#A8A69E')
  ink3:    '#94928A',   // hints, disabled (dark: '#6E6C64')
  line:    '#D8D5CB',   // hairlines (dark: '#3A382F')
  accent:  'var(--accent)',        // sampled from wardrobe
  'accent-soft': 'var(--accent-soft)', // 12% alpha of accent, for fills
  danger:  '#A32D2D', success: '#3B6D11', warn: '#854F0B',
}
```

```css
/* set by accent store after palette extraction */
:root { --accent: #185FA5; --accent-soft: rgba(24,95,165,.12); }
```

### Type

- One variable sans for everything: **Inter** (or General Sans). Weights 400 and 500 only.
- Headers: 13px, weight 500, letterspaced caps (`tracking-[0.14em]`) — `CLOSET`, `LOOKS`, `STATS`.
- Body 15px / labels 13px / captions 11px.
- **All data is mono**: wear counts, cost-per-wear, dates, item indexes → `JetBrains Mono`, tabular, 11–12px, color `ink2`. Format: `7× · €4/wear`, `#012`, `2026-05-28`.
- Optional brand moment: app name set in **Fraunces** on the landing/empty state only — nowhere else.

### Rules

1. Ground `ground`, tiles `tile`, depth via tone shift only — **no borders on tiles, no shadows, no gradients**.
2. Radii: tiles 10px, cards 14px, sheets/modals 20px, chips 999px.
3. The accent appears in at most 3 places per screen: primary action, active state, the "today" banner. Everything else is ink.
4. Item photos: bg-removed cutouts centered on `tile` with 12% padding. If bg removal is off, show photo cover-fit with a subtle inner `tile` matte.
5. Chips/filters: inactive = `ink2` text + `line` hairline; active = `ink` fill + `ground` text. Never accent-colored chips.
6. Spacing scale: 4 / 8 / 12 / 16 / 24 / 32. Screen padding 16px. Grid: 2-col mobile, gap 12px.
7. Dark mode: warm charcoal (values above), accent unchanged unless contrast < 4.5:1 → lighten sampled color until it passes.
8. Motion: 150ms ease-out fades/scale(0.98) presses. No springs, no parallax.
9. Empty states do work: each one is a single sentence + one accent action (e.g. "Your archive is empty. Add your first piece.").

### Navigation

Bottom tab bar (5): Closet · Looks · Calendar · Assistant · More (Stats, Trips, Settings inside More). Active tab = ink icon + label; inactive = `ink3`. Tabler outline icons.

---

## 3. Data model (Dexie v1)

```ts
// lib/db/schema.ts
import Dexie, { type Table } from 'dexie';

export interface Item {
  id: string;            // nanoid
  title: string;
  category: 'top'|'bottom'|'dress'|'outerwear'|'shoes'|'bag'|'accessory';
  brand?: string;
  price?: number;        // cents
  colors: string[];      // hex, extracted at upload (max 3)
  warmth: 1|2|3|4|5;
  formality: 1|2|3|4|5;
  notes?: string;
  tagIds: string[];
  archived: boolean;     // sell/donate pile, excluded from suggestions
  createdAt: number; updatedAt: number;
}
export interface Photo  { id: string; itemId: string; blob: Blob; thumb: Blob; isMain: boolean; order: number; }
export interface Tag    { id: string; name: string; }
export interface Look   { id: string; title: string; itemIds: string[]; coverPhotoId?: string; createdAt: number; updatedAt: number; }
export interface CalendarEntry { id: string; date: string /* YYYY-MM-DD */; lookId?: string; itemIds: string[]; worn: boolean; }
export interface Wear   { id: string; itemId: string; lookId?: string; date: string; }
export interface Trip   { id: string; title: string; place: string; lat: number; lon: number; start: string; end: string; itemIds: string[]; packed: string[]; }
export interface Setting { key: string; value: unknown; }  // location, accent, units, theme

export class DPDB extends Dexie {
  items!: Table<Item>; photos!: Table<Photo>; tags!: Table<Tag>;
  looks!: Table<Look>; calendar!: Table<CalendarEntry>; wears!: Table<Wear>;
  trips!: Table<Trip>; settings!: Table<Setting>;
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
```

Derived (never stored): wear count = `wears.where(itemId)`, cost-per-wear = `price / max(1, wearCount)`.

---

## 4. Phases

Build strictly in order; every phase ends usable.

**P0 Foundation (3–4d)** — scaffold, tokens above wired into Tailwind, Dexie schema, image pipeline (pick → compress → thumb → store), PWA manifest + SW, tab shell. ✓ installable, offline, photo round-trips.

**P1 Closet (4–5d)** — item CRUD + multi-photo, palette extraction → accent store, tags, category presets, filter chips + search, **bulk-add queue** (shoot N photos → annotate one by one), optional bg-removal toggle per photo. ✓ 50 items addable in one sitting.

**P2 Looks (3d)** — multi-select items → look, cover, grid with lead hero. ✓ look in ≤3 taps.

**P3 Calendar & wear (3–4d)** — month/week, schedule look/items to date, record wear (writes `wears` per item), "wore again" shortcut on item. ✓ wear flows into stats.

**P4 Stats (2–3d)** — overview metrics (count, value, wears, looks), cost-per-wear, most/least/never-worn (never-worn highlighted), category/tag/color breakdowns (color from `items.colors`). ✓ all live queries.

**P5 Weather & suggestions (3d)** — Open-Meteo geocode (settings) + 7-day forecast cached; scoring in TS: warmth fit / formality / color harmony / completeness → ranked outfits with breakdown bars. ✓ works offline on cached forecast.

**P6 Claude assistant ★ (4–5d)** — see §5. ✓ pasted prompt yields useful answer with zero edits.

**P7 Trips (2–3d)** — trip CRUD, destination forecast summary, add items/looks, packed checklist, "generate packing prompt" → §5.

**P8 Backup & polish (3–4d)** — export/import zip (lossless), onboarding empty-states, virtualized grids. ✓ export → wipe → import = identical.

Deferred: sync backend, MCP connector / Claude skill, resale deep-links, social.

---

## 5. Claude assistant (the differentiator)

### Serializer (`lib/claude/serializer.ts`)

Compact line per item (~15 tokens):

```
#012 Linen shirt — top · white/beige · warmth 2/5 · formality 2/5 · worn 12× · last 2026-05-28 · €40 · tags: summer, basics
```

Header block: today's date, location, 7-day forecast table, closet size. Full export also available as Markdown or JSON download (attach-to-chat workflow). Guard: if closet > ~150 items, offer category filter before generating.

### Prompt templates (`lib/claude/prompts/`)

Each template = system framing + serialized context + task + **required answer format** (so responses are scannable):

- **stylist** — week's forecast + calendar gaps → "Plan outfits for [dates]. Use only listed items, reference them by #id, one outfit per day with a one-line why."
- **packing** — trip place/dates/forecast + closet → "Build a packing list. Mark each item ESSENTIAL or OPTIONAL, reference #ids, flag gaps I should buy."
- **audit** — full closet incl. archived, prices, wear history → "Identify: 5 items to sell/donate and why, 3 wardrobe gaps, a 20-item capsule from what I own."
- **shopping** — one wishlist/candidate item description + closet → "Should I buy this? What does it pair with (#ids)? What do I already own that's similar?"

### UX

Assistant tab lists the four templates as cards → tap → preview sheet (editable) → `[Copy prompt]` + native share sheet → caption "Paste into your Claude app". Stretch: paste-back parser for packing (match `#id`s → tick trip items).

---

## 6. Definition of done (v1 ship)

- Lighthouse PWA installable; full offline after first load
- 100-item closet: closet grid scrolls at 60fps on mid-range Android
- All four prompts produce correct, useful Claude answers with no manual editing
- Export/import lossless; no data leaves the device except Open-Meteo calls
- WCAG AA contrast in both themes (incl. sampled accent after auto-adjust)
