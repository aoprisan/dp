<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { db, type CalendarEntry, type Item, type Photo, type Tag, type Trip, type Wear } from '$lib/db/schema';
  import { live } from '$lib/db/live';
  import { scheduleEntry } from '$lib/db/repo';
  import type { SavedLocation } from '$lib/stores/settings';
  import { cachedForecast, getForecast, wmoGlyph, type Forecast } from '$lib/weather/openMeteo';
  import { suggestOutfits } from '$lib/suggest/scoring';
  import { buildSnapshot, exportJson, exportMarkdown, type AssistantCtx, type PromptTemplate } from '$lib/claude/serializer';
  import { templates } from '$lib/claude/prompts';
  import { CATEGORIES } from '$lib/db/schema';
  import { toast } from '$lib/stores/toast.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Sheet from '$lib/components/Sheet.svelte';
  import ItemPhoto from '$lib/components/ItemPhoto.svelte';
  import IconSun from '@tabler/icons-svelte/icons/sun';
  import IconCloud from '@tabler/icons-svelte/icons/cloud';
  import IconMist from '@tabler/icons-svelte/icons/mist';
  import IconCloudRain from '@tabler/icons-svelte/icons/cloud-rain';
  import IconSnowflake from '@tabler/icons-svelte/icons/snowflake';
  import IconCloudStorm from '@tabler/icons-svelte/icons/cloud-storm';
  import IconCopy from '@tabler/icons-svelte/icons/copy';
  import IconShare2 from '@tabler/icons-svelte/icons/share-2';
  import IconCalendarPlus from '@tabler/icons-svelte/icons/calendar-plus';
  import IconSparkles from '@tabler/icons-svelte/icons/sparkles';
  import IconDownload from '@tabler/icons-svelte/icons/download';

  const GLYPHS = {
    sun: IconSun,
    cloud: IconCloud,
    fog: IconMist,
    rain: IconCloudRain,
    snow: IconSnowflake,
    storm: IconCloudStorm,
  } as const;

  const items = live<Item[]>(() => db.items.toArray(), []);
  const wears = live<Wear[]>(() => db.wears.toArray(), []);
  const tags = live<Tag[]>(() => db.tags.toArray(), []);
  const looks = live(() => db.looks.toArray(), []);
  const entries = live<CalendarEntry[]>(() => db.calendar.toArray(), []);
  const trips = live<Trip[]>(() => db.trips.orderBy('start').reverse().toArray(), []);
  const mains = live<Photo[]>(() => db.photos.filter((p) => p.isMain).toArray(), []);
  const settings = live(() => db.settings.toArray(), []);

  const location = $derived($settings.find((s) => s.key === 'location')?.value as SavedLocation | undefined);
  const photoByItem = $derived(new Map($mains.map((p) => [p.itemId, p])));
  const lookById = $derived(new Map($looks.map((l) => [l.id, l])));
  const active = $derived($items.filter((i) => !i.archived));

  // ---- weather (P5) ----
  let forecast = $state<Forecast | undefined>(undefined);
  let weatherFailed = $state(false);
  let fetchedFor = $state('');
  $effect(() => {
    const loc = location;
    if (!loc) return;
    const key = `${loc.lat},${loc.lon}`;
    if (fetchedFor === key) return;
    fetchedFor = key;
    getForecast(loc.lat, loc.lon, 7)
      .then((f) => (forecast = f))
      .catch(async () => {
        forecast = await cachedForecast();
        weatherFailed = !forecast;
      });
  });

  let dayIdx = $state(0);
  const day = $derived(forecast?.days[dayIdx]);
  const suggestions = $derived(day ? suggestOutfits(active, day, 4) : []);

  function plannedFor(date: string): string | undefined {
    const e = $entries.find((x) => x.date === date);
    if (!e) return undefined;
    if (e.lookId) return lookById.get(e.lookId)?.title ?? 'a look';
    return `${e.itemIds.length} pieces`;
  }

  async function planSuggestion(itemIds: string[]) {
    if (!day) return;
    await scheduleEntry(day.date, undefined, itemIds);
    toast.show(`Planned for ${day.date}`);
  }

  function weekday(date: string): string {
    return new Date(date + 'T12:00').toLocaleDateString('en', { weekday: 'short' });
  }

  // ---- prompts (P6) ----
  let activeTemplate = $state<PromptTemplate | null>(null);
  let promptText = $state('');
  let generated = $state(false);
  let candidate = $state('');
  let tripId = $state<string | null>(null);
  let categories = $state<string[]>([]);

  const needsGuard = $derived($items.length > 150); // §5 guard
  const selectedTrip = $derived(tripId ? $trips.find((t) => t.id === tripId) : undefined);

  function openTemplate(t: PromptTemplate) {
    activeTemplate = t;
    generated = false;
    promptText = '';
    categories = [];
    if (t.id === 'packing' && $trips.length && !tripId) tripId = $trips[0].id;
  }

  // deep link: /assistant?template=packing&trip=ID (from the trips page)
  let linked = $state(false);
  $effect(() => {
    if (linked) return;
    const t = page.url.searchParams.get('template');
    if (!t) return;
    const template = templates.find((x) => x.id === t);
    if (template) {
      linked = true;
      tripId = page.url.searchParams.get('trip');
      openTemplate(template);
    }
  });

  async function generate() {
    if (!activeTemplate) return;
    const ctx: AssistantCtx = {
      snap: buildSnapshot($items, $wears, $tags),
      location: location?.name,
      forecast,
      categories: categories.length ? categories : undefined,
      candidate,
    };
    if (activeTemplate.id === 'stylist' && forecast) {
      ctx.dates = forecast.days.slice(0, 7).map((d) => ({ date: d.date, planned: plannedFor(d.date) }));
    }
    if (activeTemplate.id === 'packing' && selectedTrip) {
      ctx.trip = selectedTrip;
      try {
        const f = await getForecast(selectedTrip.lat, selectedTrip.lon, 16);
        ctx.tripForecast = f.days.filter((d) => d.date >= selectedTrip.start && d.date <= selectedTrip.end);
      } catch {
        /* destination forecast is a bonus — prompt still works */
      }
    }
    promptText = activeTemplate.build(ctx);
    generated = true;
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(promptText);
      toast.show('Copied — paste into your Claude app');
    } catch {
      toast.show('Copy failed');
    }
  }

  async function sharePrompt() {
    if (navigator.share) {
      try {
        await navigator.share({ text: promptText });
      } catch {
        /* user cancelled */
      }
    } else {
      copyPrompt();
    }
  }

  function download(name: string, text: string, type: string) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  function exportCloset(kind: 'md' | 'json') {
    const snap = buildSnapshot($items, $wears, $tags);
    if (kind === 'md') download('closet.md', exportMarkdown(snap), 'text/markdown');
    else download('closet.json', exportJson(snap), 'application/json');
  }
</script>

<PageHeader title="Assistant" />

<div class="flex flex-col gap-6 px-4">
  <!-- weather + suggestions (P5) -->
  {#if !location}
    <div class="rounded-card bg-tile px-4 py-4">
      <p class="text-[14px] text-ink2">
        Set your location to get weather-aware outfit suggestions.
      </p>
      <a href="{base}/settings" class="mt-2 inline-block text-[14px] font-medium text-accent">Open settings</a>
    </div>
  {:else if forecast}
    <section>
      <div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {#each forecast.days.slice(0, 7) as d, i (d.date)}
          {@const Glyph = GLYPHS[wmoGlyph(d.code)]}
          <button
            class="press flex shrink-0 flex-col items-center gap-1 rounded-tile px-3 py-2.5 {i === dayIdx
              ? 'bg-tile2'
              : 'bg-tile'}"
            onclick={() => (dayIdx = i)}
          >
            <span class="data {i === dayIdx ? 'text-ink' : 'text-ink3'}">{i === 0 ? 'today' : weekday(d.date)}</span>
            <Glyph size={18} stroke={1.5} class={i === dayIdx ? 'text-ink' : 'text-ink2'} />
            <span class="data">{Math.round(d.tMin)}–{Math.round(d.tMax)}°</span>
          </button>
        {/each}
      </div>
    </section>

    {#if active.length === 0}
      <p class="text-[14px] text-ink2">Add pieces to your closet to get suggestions.</p>
    {:else if suggestions.length}
      <section class="flex flex-col gap-3">
        {#each suggestions as s, si (si)}
          <div class="rounded-card bg-tile p-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex flex-1 gap-2 overflow-x-auto no-scrollbar">
                {#each s.items as it (it.id)}
                  <a href="{base}/closet/item?id={it.id}" class="h-16 w-16 shrink-0">
                    <ItemPhoto photo={photoByItem.get(it.id)} alt={it.title} />
                  </a>
                {/each}
              </div>
              <span class="data shrink-0">{Math.round(s.score * 100)}</span>
            </div>
            <div class="mt-2.5 flex items-center gap-2">
              {#each [
                ['warmth', s.parts.warmth],
                ['match', s.parts.formality],
                ['color', s.parts.color],
                ['complete', s.parts.completeness],
              ] as const as [label, v] (label)}
                <div class="flex-1">
                  <div class="h-1 overflow-hidden rounded-full bg-tile2">
                    <div class="h-full rounded-full bg-ink2" style="width:{v * 100}%"></div>
                  </div>
                  <span class="data mt-0.5 block text-center text-ink3">{label}</span>
                </div>
              {/each}
              <button
                class="press ml-1 shrink-0 rounded-full bg-tile2 p-2 text-ink"
                aria-label="Plan this outfit"
                onclick={() => planSuggestion(s.items.map((i) => i.id))}
              >
                <IconCalendarPlus size={16} stroke={1.75} />
              </button>
            </div>
          </div>
        {/each}
      </section>
    {/if}
  {:else if weatherFailed}
    <p class="text-[14px] text-ink2">No forecast available — suggestions return once you're online.</p>
  {/if}

  <!-- Claude prompt templates (P6) -->
  <section>
    <h2 class="caps-header mb-3">Ask Claude</h2>
    <div class="grid grid-cols-2 gap-3">
      {#each templates as t (t.id)}
        <button class="press rounded-card bg-tile p-4 text-left" onclick={() => openTemplate(t)}>
          <IconSparkles size={18} stroke={1.5} class="mb-2 text-ink2" />
          <p class="text-[14px] font-medium text-ink">{t.title}</p>
          <p class="mt-1 text-[12px] leading-snug text-ink2">{t.blurb}</p>
        </button>
      {/each}
    </div>
    <p class="data mt-2 text-ink3">prompts are built from your closet — zero API costs, paste into your Claude app</p>
  </section>

  <section class="pb-4">
    <h2 class="caps-header mb-2">Full export</h2>
    <div class="flex gap-3">
      <button class="btn-ghost flex-1 text-[13px]" onclick={() => exportCloset('md')}>
        <IconDownload size={15} stroke={1.75} /> closet.md
      </button>
      <button class="btn-ghost flex-1 text-[13px]" onclick={() => exportCloset('json')}>
        <IconDownload size={15} stroke={1.75} /> closet.json
      </button>
    </div>
  </section>
</div>

<Sheet
  bind:open={() => activeTemplate !== null, (v) => {
    if (!v) activeTemplate = null;
  }}
  title={activeTemplate?.title ?? ''}
>
  {#if activeTemplate}
    {#if !generated}
      <div class="flex flex-col gap-4">
        {#if activeTemplate.id === 'shopping'}
          <textarea
            class="input-field min-h-24"
            placeholder="Describe the candidate — e.g. 'Camel wool overcoat, €240, knee length'"
            bind:value={candidate}
          ></textarea>
        {/if}

        {#if activeTemplate.id === 'packing'}
          {#if $trips.length}
            <div>
              <p class="mb-2 text-[13px] text-ink2">Trip</p>
              <div class="flex flex-wrap gap-2">
                {#each $trips as t (t.id)}
                  <button class="chip {tripId === t.id ? 'chip-active' : ''}" onclick={() => (tripId = t.id)}>
                    {t.title}
                  </button>
                {/each}
              </div>
            </div>
          {:else}
            <p class="text-[13px] text-ink2">
              No trips yet — <a class="text-accent" href="{base}/trips">create one</a> or generate and fill in the destination yourself.
            </p>
          {/if}
        {/if}

        {#if needsGuard && activeTemplate.id !== 'audit'}
          <div>
            <p class="mb-2 text-[13px] text-ink2">
              Your closet is large ({$items.length} items) — narrow it down to keep the prompt sharp:
            </p>
            <div class="flex flex-wrap gap-2">
              {#each CATEGORIES as cat (cat)}
                <button
                  class="chip {categories.includes(cat) ? 'chip-active' : ''}"
                  onclick={() =>
                    (categories = categories.includes(cat)
                      ? categories.filter((c) => c !== cat)
                      : [...categories, cat])}
                >
                  {cat}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <button
          class="btn-primary w-full"
          disabled={activeTemplate.id === 'shopping' && !candidate.trim()}
          onclick={generate}
        >
          Build prompt
        </button>
      </div>
    {:else}
      <div class="flex flex-col gap-3">
        <textarea class="input-field min-h-56 font-mono text-[12px] leading-relaxed" bind:value={promptText}
        ></textarea>
        <div class="flex gap-3">
          <button class="btn-primary flex-1" onclick={copyPrompt}>
            <IconCopy size={16} stroke={2} /> Copy prompt
          </button>
          <button class="btn-ghost flex-1" onclick={sharePrompt}>
            <IconShare2 size={16} stroke={1.75} /> Share
          </button>
        </div>
        <p class="data text-center text-ink3">paste into your Claude app</p>
      </div>
    {/if}
  {/if}
</Sheet>
