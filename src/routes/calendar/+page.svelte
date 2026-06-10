<script lang="ts">
  import { base } from '$app/paths';
  import { db, type CalendarEntry, type Item, type Look, type Photo } from '$lib/db/schema';
  import { live } from '$lib/db/live';
  import { markWorn, scheduleEntry, todayStr, unmarkWorn } from '$lib/db/repo';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Sheet from '$lib/components/Sheet.svelte';
  import ItemPickerSheet from '$lib/components/ItemPickerSheet.svelte';
  import ItemPhoto from '$lib/components/ItemPhoto.svelte';
  import IconChevronLeft from '@tabler/icons-svelte/icons/chevron-left';
  import IconChevronRight from '@tabler/icons-svelte/icons/chevron-right';
  import IconCircleCheck from '@tabler/icons-svelte/icons/circle-check';
  import IconStack2 from '@tabler/icons-svelte/icons/stack-2';
  import IconPlus from '@tabler/icons-svelte/icons/plus';
  import IconTrash from '@tabler/icons-svelte/icons/trash';

  const today = todayStr();
  let viewYear = $state(new Date().getFullYear());
  let viewMonth = $state(new Date().getMonth()); // 0-based

  const entries = live<CalendarEntry[]>(() => db.calendar.toArray(), []);
  const looks = live<Look[]>(() => db.looks.toArray(), []);
  const items = live<Item[]>(() => db.items.toArray(), []);
  const mains = live<Photo[]>(() => db.photos.filter((p) => p.isMain).toArray(), []);

  const lookById = $derived(new Map($looks.map((l) => [l.id, l])));
  const itemById = $derived(new Map($items.map((i) => [i.id, i])));
  const photoByItem = $derived(new Map($mains.map((p) => [p.itemId, p])));
  const entriesByDate = $derived(
    $entries.reduce((m, e) => {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      return m.set(e.date, arr);
    }, new Map<string, CalendarEntry[]>()),
  );

  const monthLabel = $derived(
    new Date(viewYear, viewMonth, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' }),
  );
  // Monday-start grid
  const cells = $derived.by(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const lead = (first.getDay() + 6) % 7;
    const count = new Date(viewYear, viewMonth + 1, 0).getDate();
    const out: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= count; d++)
      out.push(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    return out;
  });

  function shiftMonth(by: number) {
    const d = new Date(viewYear, viewMonth + by, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
  }

  let selectedDate = $state<string | null>(null);
  let lookPicking = $state(false);
  let itemPicking = $state(false);
  let editingEntryId = $state<string | null>(null);
  let pickerSelection = $state<string[]>([]);

  const dayEntries = $derived(selectedDate ? (entriesByDate.get(selectedDate) ?? []) : []);

  function fullItemIds(e: CalendarEntry): string[] {
    const ids = new Set(e.itemIds);
    if (e.lookId) lookById.get(e.lookId)?.itemIds.forEach((i) => ids.add(i));
    return [...ids];
  }

  function entryTitle(e: CalendarEntry): string {
    if (e.lookId) return lookById.get(e.lookId)?.title ?? 'Look';
    const n = fullItemIds(e).length;
    return `${n} ${n === 1 ? 'piece' : 'pieces'}`;
  }

  async function ensureEntry(date: string): Promise<CalendarEntry> {
    const existing = entriesByDate.get(date)?.[0];
    if (existing) return existing;
    const id = await scheduleEntry(date, undefined, []);
    return { id, date, itemIds: [], worn: false };
  }

  async function pickLook(lookId: string) {
    if (!selectedDate) return;
    const entry = await ensureEntry(selectedDate);
    await db.calendar.update(entry.id, { lookId });
    lookPicking = false;
  }

  async function startItemPick() {
    if (!selectedDate) return;
    const entry = await ensureEntry(selectedDate);
    editingEntryId = entry.id;
    pickerSelection = [...entry.itemIds];
    itemPicking = true;
  }

  // write picker selection through to the entry as it changes
  $effect(() => {
    if (editingEntryId && itemPicking) {
      const ids = [...pickerSelection];
      db.calendar.update(editingEntryId, { itemIds: ids });
    }
  });
  $effect(() => {
    if (!itemPicking) editingEntryId = null;
  });

  // today banner data (the screen's accent moment, §2 rule 3)
  const todayEntry = $derived(entriesByDate.get(today)?.[0]);
</script>

<PageHeader title="Calendar" />

<div class="px-4">
  <div class="mb-3 rounded-card bg-accent-soft px-4 py-3">
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="data text-ink2">today · {today}</p>
        <p class="mt-0.5 truncate text-[15px] text-ink">
          {#if todayEntry}
            {entryTitle(todayEntry)}{todayEntry.worn ? ' — worn' : ''}
          {:else}
            Nothing planned yet.
          {/if}
        </p>
      </div>
      {#if todayEntry && !todayEntry.worn}
        <button class="btn-primary shrink-0 px-4 py-2 text-[13px]" onclick={() => markWorn(todayEntry.id)}>
          <IconCircleCheck size={15} stroke={2} /> Wore it
        </button>
      {:else if !todayEntry}
        <button class="btn-primary shrink-0 px-4 py-2 text-[13px]" onclick={() => (selectedDate = today)}>
          Plan today
        </button>
      {/if}
    </div>
  </div>

  <div class="mb-2 flex items-center justify-between">
    <button class="press p-2 text-ink2" aria-label="Previous month" onclick={() => shiftMonth(-1)}>
      <IconChevronLeft size={18} stroke={1.75} />
    </button>
    <span class="text-[15px] font-medium text-ink">{monthLabel}</span>
    <button class="press p-2 text-ink2" aria-label="Next month" onclick={() => shiftMonth(1)}>
      <IconChevronRight size={18} stroke={1.75} />
    </button>
  </div>

  <div class="grid grid-cols-7 gap-1">
    {#each ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as wd, i (i)}
      <span class="data pb-1 text-center text-ink3">{wd}</span>
    {/each}
    {#each cells as date, i (i)}
      {#if date === null}
        <span></span>
      {:else}
        {@const dayEntryList = entriesByDate.get(date) ?? []}
        {@const worn = dayEntryList.some((e) => e.worn)}
        {@const planned = dayEntryList.length > 0}
        <button
          class="press relative flex aspect-square flex-col items-center justify-center rounded-tile
            {date === today ? 'bg-accent-soft' : planned ? 'bg-tile' : ''}"
          onclick={() => (selectedDate = date)}
        >
          <span class="data {date === today ? 'font-medium text-accent' : 'text-ink2'}">
            {Number(date.slice(8))}
          </span>
          {#if planned}
            <span
              class="absolute bottom-1.5 h-1.5 w-1.5 rounded-full {worn ? 'bg-ink' : 'border border-ink3'}"
            ></span>
          {/if}
        </button>
      {/if}
    {/each}
  </div>

  <div class="data mt-3 flex justify-center gap-4 text-ink3">
    <span class="flex items-center gap-1.5"><span class="h-1.5 w-1.5 rounded-full border border-ink3"></span> planned</span>
    <span class="flex items-center gap-1.5"><span class="h-1.5 w-1.5 rounded-full bg-ink"></span> worn</span>
  </div>
</div>

<Sheet
  bind:open={() => selectedDate !== null && !itemPicking && !lookPicking, (v) => {
    if (!v) selectedDate = null;
  }}
  title={selectedDate === today ? `today · ${today}` : (selectedDate ?? '')}
>
  {#if dayEntries.length === 0}
    <p class="pb-4 text-[15px] text-ink2">Nothing planned for this day.</p>
  {:else}
    <div class="flex flex-col gap-3 pb-4">
      {#each dayEntries as entry (entry.id)}
        {@const ids = fullItemIds(entry)}
        <div class="rounded-card bg-tile p-3">
          <div class="flex items-center justify-between">
            <p class="text-[15px] text-ink">{entryTitle(entry)}</p>
            <button
              class="press p-1 text-ink3"
              aria-label="Remove plan"
              onclick={() => db.calendar.delete(entry.id)}
            >
              <IconTrash size={16} stroke={1.75} />
            </button>
          </div>
          {#if ids.length}
            <div class="mt-2 grid grid-cols-4 gap-2">
              {#each ids as itemId (itemId)}
                <div class="aspect-square">
                  <ItemPhoto photo={photoByItem.get(itemId)} alt={itemById.get(itemId)?.title ?? ''} />
                </div>
              {/each}
            </div>
          {/if}
          <button
            class="press mt-3 flex w-full items-center justify-center gap-1.5 rounded-tile py-2.5 text-[13px] font-medium
              {entry.worn ? 'bg-tile2 text-ink2' : 'bg-ink text-ground'}"
            onclick={() => (entry.worn ? unmarkWorn(entry.id) : markWorn(entry.id))}
          >
            <IconCircleCheck size={15} stroke={2} />
            {entry.worn ? 'Worn — undo' : 'Mark worn'}
          </button>
        </div>
      {/each}
    </div>
  {/if}
  <div class="flex gap-3">
    <button class="btn-ghost flex-1 text-[13px]" onclick={() => (lookPicking = true)}>
      <IconStack2 size={16} stroke={1.75} /> Schedule look
    </button>
    <button class="btn-ghost flex-1 text-[13px]" onclick={startItemPick}>
      <IconPlus size={16} stroke={1.75} /> Add pieces
    </button>
  </div>
</Sheet>

<Sheet bind:open={lookPicking} title="Schedule a look">
  {#if $looks.length === 0}
    <p class="pb-2 text-[15px] text-ink2">
      No looks yet. <a class="text-accent" href="{base}/looks/edit">Build one first.</a>
    </p>
  {:else}
    <div class="flex flex-col gap-1">
      {#each $looks as look (look.id)}
        <button
          class="press flex items-center justify-between rounded-tile px-3 py-3 text-left hover:bg-tile"
          onclick={() => pickLook(look.id)}
        >
          <span class="text-[15px] text-ink">{look.title}</span>
          <span class="data">{look.itemIds.length} pieces</span>
        </button>
      {/each}
    </div>
  {/if}
</Sheet>

<ItemPickerSheet bind:open={itemPicking} bind:selected={pickerSelection} title="Pieces for {selectedDate}" />
