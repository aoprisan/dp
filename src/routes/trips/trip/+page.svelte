<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { db, type Item, type Look, type Photo, type Trip } from '$lib/db/schema';
  import { live } from '$lib/db/live';
  import { addTrip, todayStr } from '$lib/db/repo';
  import { geocode, getForecast, wmoGlyph, type DayForecast, type GeoResult } from '$lib/weather/openMeteo';
  import { toast } from '$lib/stores/toast.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Sheet from '$lib/components/Sheet.svelte';
  import ItemPickerSheet from '$lib/components/ItemPickerSheet.svelte';
  import ItemPhoto from '$lib/components/ItemPhoto.svelte';
  import IconArrowLeft from '@tabler/icons-svelte/icons/arrow-left';
  import IconPlus from '@tabler/icons-svelte/icons/plus';
  import IconTrash from '@tabler/icons-svelte/icons/trash';
  import IconStack2 from '@tabler/icons-svelte/icons/stack-2';
  import IconSparkles from '@tabler/icons-svelte/icons/sparkles';
  import IconSun from '@tabler/icons-svelte/icons/sun';
  import IconCloud from '@tabler/icons-svelte/icons/cloud';
  import IconMist from '@tabler/icons-svelte/icons/mist';
  import IconCloudRain from '@tabler/icons-svelte/icons/cloud-rain';
  import IconSnowflake from '@tabler/icons-svelte/icons/snowflake';
  import IconCloudStorm from '@tabler/icons-svelte/icons/cloud-storm';
  import IconCheck from '@tabler/icons-svelte/icons/check';

  const GLYPHS = {
    sun: IconSun,
    cloud: IconCloud,
    fog: IconMist,
    rain: IconCloudRain,
    snow: IconSnowflake,
    storm: IconCloudStorm,
  } as const;

  const id = $derived(page.url.searchParams.get('id'));
  const tripQ = $derived(live<Trip | undefined>(() => (id ? db.trips.get(id) : undefined), undefined));
  const trip = $derived($tripQ);

  const items = live<Item[]>(() => db.items.toArray(), []);
  const looks = live<Look[]>(() => db.looks.toArray(), []);
  const mains = live<Photo[]>(() => db.photos.filter((p) => p.isMain).toArray(), []);
  const itemById = $derived(new Map($items.map((i) => [i.id, i])));
  const photoByItem = $derived(new Map($mains.map((p) => [p.itemId, p])));

  // ---- creation form (no id yet) ----
  let title = $state('');
  let placeQuery = $state('');
  let place = $state<GeoResult | null>(null);
  let results = $state<GeoResult[]>([]);
  let start = $state(todayStr());
  let end = $state(todayStr());

  async function searchPlace() {
    if (!placeQuery.trim()) return;
    try {
      results = await geocode(placeQuery);
      if (!results.length) toast.show('No places found');
    } catch {
      toast.show('Search failed — are you offline?');
    }
  }

  async function create() {
    if (!place) return;
    const placeName = [place.name, place.country].filter(Boolean).join(', ');
    const newTripId = await addTrip({
      title: title.trim() || `Trip to ${place.name}`,
      place: placeName,
      lat: place.lat,
      lon: place.lon,
      start,
      end: end < start ? start : end,
      itemIds: [],
      packed: [],
    });
    goto(`${base}/trips/trip?id=${newTripId}`, { replaceState: true });
  }

  // ---- destination forecast ----
  let tripDays = $state<DayForecast[]>([]);
  let forecastFor = $state('');
  $effect(() => {
    const t = trip;
    if (!t) return;
    const key = `${t.lat},${t.lon},${t.start},${t.end}`;
    if (forecastFor === key) return;
    forecastFor = key;
    getForecast(t.lat, t.lon, 16)
      .then((f) => (tripDays = f.days.filter((d) => d.date >= t.start && d.date <= t.end)))
      .catch(() => (tripDays = []));
  });

  // ---- packing ----
  let picking = $state(false);
  let lookPicking = $state(false);
  let pickerSelection = $state<string[]>([]);

  function startPick() {
    if (!trip) return;
    pickerSelection = [...trip.itemIds];
    picking = true;
  }
  $effect(() => {
    if (picking && trip) {
      const ids = [...pickerSelection];
      db.trips.update(trip.id, {
        itemIds: ids,
        packed: trip.packed.filter((p) => ids.includes(p)),
      });
    }
  });

  async function addLookItems(look: Look) {
    if (!trip) return;
    const ids = [...new Set([...trip.itemIds, ...look.itemIds])];
    await db.trips.update(trip.id, { itemIds: ids });
    lookPicking = false;
    toast.show(`Added “${look.title}”`);
  }

  async function togglePacked(itemId: string) {
    if (!trip) return;
    const packed = trip.packed.includes(itemId)
      ? trip.packed.filter((p) => p !== itemId)
      : [...trip.packed, itemId];
    await db.trips.update(trip.id, { packed });
  }

  async function removeTrip() {
    if (!trip) return;
    if (!confirm(`Delete “${trip.title}”?`)) return;
    await db.trips.delete(trip.id);
    goto(`${base}/trips`);
  }

  const tripItems = $derived(
    trip ? trip.itemIds.map((i) => itemById.get(i)).filter((x): x is Item => !!x) : [],
  );
</script>

<PageHeader title={trip ? trip.title : 'New trip'}>
  <a href="{base}/trips" class="press p-1 text-ink2" aria-label="Back to trips">
    <IconArrowLeft size={20} stroke={1.75} />
  </a>
</PageHeader>

{#if !trip}
  <div class="flex flex-col gap-4 px-4">
    <input class="input-field" placeholder="Trip title — e.g. Lisbon long weekend" bind:value={title} />
    <form
      class="flex gap-2"
      onsubmit={(e) => {
        e.preventDefault();
        searchPlace();
      }}
    >
      <input class="input-field flex-1" placeholder="Destination city" bind:value={placeQuery} />
      <button type="submit" class="btn-ghost px-4">Find</button>
    </form>
    {#if results.length}
      <div class="flex flex-col">
        {#each results as r (r.lat + ':' + r.lon)}
          <button
            class="press rounded-tile px-3 py-2.5 text-left text-[14px] {place === r ? 'bg-tile' : ''} hover:bg-tile"
            onclick={() => {
              place = r;
              results = [r];
            }}
          >
            {[r.name, r.admin1, r.country].filter(Boolean).join(', ')}
            {#if place === r}<span class="text-accent"> ✓</span>{/if}
          </button>
        {/each}
      </div>
    {/if}
    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1">
        <span class="text-[13px] text-ink2">From</span>
        <input type="date" class="input-field" bind:value={start} />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-[13px] text-ink2">To</span>
        <input type="date" class="input-field" bind:value={end} />
      </label>
    </div>
    <button class="btn-primary w-full" disabled={!place} onclick={create}>Create trip</button>
  </div>
{:else}
  <div class="flex flex-col gap-5 px-4">
    <div class="rounded-card bg-tile px-4 py-3">
      <div class="flex items-center justify-between">
        <span class="text-[14px] text-ink">{trip.place}</span>
        <span class="data">{trip.start} → {trip.end}</span>
      </div>
      {#if tripDays.length}
        <div class="no-scrollbar -mx-1 mt-2.5 flex gap-2 overflow-x-auto px-1">
          {#each tripDays as d (d.date)}
            {@const Glyph = GLYPHS[wmoGlyph(d.code)]}
            <div class="flex shrink-0 flex-col items-center gap-0.5 rounded-tile bg-tile2 px-2.5 py-2">
              <span class="data text-ink3">{d.date.slice(5)}</span>
              <Glyph size={16} stroke={1.5} class="text-ink2" />
              <span class="data">{Math.round(d.tMin)}–{Math.round(d.tMax)}°</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div>
      <div class="mb-2 flex items-center justify-between">
        <h2 class="caps-header">Packing list</h2>
        <span class="data">{trip.packed.length}/{trip.itemIds.length}</span>
      </div>
      {#if tripItems.length === 0}
        <p class="mb-3 text-[14px] text-ink2">Nothing on the list yet — add pieces or pull in a look.</p>
      {:else}
        <div class="flex flex-col gap-1.5">
          {#each tripItems as item (item.id)}
            {@const packed = trip.packed.includes(item.id)}
            <button
              class="press flex w-full items-center gap-3 rounded-tile px-2 py-1.5 text-left {packed ? 'opacity-60' : ''}"
              onclick={() => togglePacked(item.id)}
            >
              <div class="h-11 w-11 shrink-0"><ItemPhoto photo={photoByItem.get(item.id)} alt="" /></div>
              <span class="flex-1 truncate text-[14px] {packed ? 'text-ink2 line-through' : 'text-ink'}">
                {item.title}
              </span>
              <span
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full {packed
                  ? 'bg-ink text-ground'
                  : 'border border-line text-transparent'}"
              >
                <IconCheck size={14} stroke={2.5} />
              </span>
            </button>
          {/each}
        </div>
      {/if}
      <div class="mt-3 flex gap-3">
        <button class="btn-ghost flex-1 text-[13px]" onclick={startPick}>
          <IconPlus size={15} stroke={1.75} /> Pieces
        </button>
        <button class="btn-ghost flex-1 text-[13px]" onclick={() => (lookPicking = true)}>
          <IconStack2 size={15} stroke={1.75} /> From a look
        </button>
      </div>
    </div>

    <a href="{base}/assistant?template=packing&trip={trip.id}" class="btn-primary w-full">
      <IconSparkles size={16} stroke={2} /> Generate packing prompt
    </a>

    <button class="btn-ghost w-full text-[13px] text-danger" onclick={removeTrip}>
      <IconTrash size={15} stroke={1.75} /> Delete trip
    </button>
  </div>
{/if}

<Sheet bind:open={lookPicking} title="Add a look's pieces">
  {#if $looks.length === 0}
    <p class="pb-2 text-[15px] text-ink2">No looks yet.</p>
  {:else}
    <div class="flex flex-col gap-1">
      {#each $looks as look (look.id)}
        <button
          class="press flex items-center justify-between rounded-tile px-3 py-3 text-left hover:bg-tile"
          onclick={() => addLookItems(look)}
        >
          <span class="text-[15px] text-ink">{look.title}</span>
          <span class="data">{look.itemIds.length} pieces</span>
        </button>
      {/each}
    </div>
  {/if}
</Sheet>

<ItemPickerSheet bind:open={picking} bind:selected={pickerSelection} title="Pack pieces" />
