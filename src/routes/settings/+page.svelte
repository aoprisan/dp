<script lang="ts">
  import { base } from '$app/paths';
  import { db } from '$lib/db/schema';
  import { live } from '$lib/db/live';
  import { setSetting } from '$lib/db/repo';
  import { geocode, type GeoResult } from '$lib/weather/openMeteo';
  import { recomputeAccent } from '$lib/stores/accent';
  import { saveBackup, importBackup } from '$lib/backup';
  import type { SavedLocation, Theme } from '$lib/stores/settings';
  import { toast } from '$lib/stores/toast.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import IconArrowLeft from '@tabler/icons-svelte/icons/arrow-left';
  import IconMapPin from '@tabler/icons-svelte/icons/map-pin';
  import IconDownload from '@tabler/icons-svelte/icons/download';
  import IconUpload from '@tabler/icons-svelte/icons/upload';
  import IconRefresh from '@tabler/icons-svelte/icons/refresh';

  const settings = live(() => db.settings.toArray(), []);
  const location = $derived($settings.find((s) => s.key === 'location')?.value as SavedLocation | undefined);
  const theme = $derived(($settings.find((s) => s.key === 'theme')?.value as Theme) ?? 'system');
  const accent = $derived($settings.find((s) => s.key === 'accent')?.value as string | undefined);

  let query = $state('');
  let results = $state<GeoResult[]>([]);
  let searching = $state(false);
  let importing = $state(false);
  let importInput: HTMLInputElement;

  async function search() {
    if (!query.trim()) return;
    searching = true;
    try {
      results = await geocode(query);
      if (!results.length) toast.show('No places found');
    } catch {
      toast.show('Search failed — are you offline?');
    } finally {
      searching = false;
    }
  }

  async function pick(r: GeoResult) {
    const name = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
    await setSetting('location', { name, lat: r.lat, lon: r.lon } satisfies SavedLocation);
    results = [];
    query = '';
    toast.show('Location saved');
  }

  async function onImport(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!file) return;
    if (!confirm('Importing replaces everything currently in the app. Continue?')) return;
    importing = true;
    try {
      await importBackup(file);
      toast.show('Backup restored');
    } catch (err) {
      console.error(err);
      toast.show(err instanceof Error ? err.message : 'Import failed');
    } finally {
      importing = false;
    }
  }
</script>

<PageHeader title="Settings">
  <a href="{base}/more" class="press p-1 text-ink2" aria-label="Back">
    <IconArrowLeft size={20} stroke={1.75} />
  </a>
</PageHeader>

<div class="flex flex-col gap-7 px-4">
  <section>
    <h2 class="caps-header mb-2">Location</h2>
    <p class="mb-3 text-[13px] text-ink2">Used for the forecast and outfit suggestions. Weather is the only thing this app talks to the network for.</p>
    {#if location}
      <div class="mb-3 flex items-center gap-2 rounded-card bg-tile px-4 py-3">
        <IconMapPin size={16} stroke={1.75} class="text-ink2" />
        <span class="flex-1 text-[14px] text-ink">{location.name}</span>
        <span class="data">{location.lat.toFixed(2)}, {location.lon.toFixed(2)}</span>
      </div>
    {/if}
    <form
      class="flex gap-2"
      onsubmit={(e) => {
        e.preventDefault();
        search();
      }}
    >
      <input class="input-field flex-1" placeholder="Search a city" bind:value={query} />
      <button type="submit" class="btn-ghost px-4" disabled={searching}>{searching ? '…' : 'Find'}</button>
    </form>
    {#if results.length}
      <div class="mt-2 flex flex-col">
        {#each results as r (r.lat + ':' + r.lon)}
          <button class="press rounded-tile px-3 py-2.5 text-left text-[14px] hover:bg-tile" onclick={() => pick(r)}>
            {[r.name, r.admin1, r.country].filter(Boolean).join(', ')}
          </button>
        {/each}
      </div>
    {/if}
  </section>

  <section>
    <h2 class="caps-header mb-3">Theme</h2>
    <div class="flex gap-2">
      {#each ['system', 'light', 'dark'] as const as t (t)}
        <button class="chip {theme === t ? 'chip-active' : ''}" onclick={() => setSetting('theme', t)}>{t}</button>
      {/each}
    </div>
  </section>

  <section>
    <h2 class="caps-header mb-2">Accent</h2>
    <p class="mb-3 text-[13px] text-ink2">Sampled from your own wardrobe — it changes as your closet does.</p>
    <div class="flex items-center gap-3">
      <span class="inline-block h-8 w-8 rounded-full" style="background: var(--accent)"></span>
      <span class="data">{accent ?? 'fallback'}</span>
      <button class="btn-ghost ml-auto px-4 py-2 text-[13px]" onclick={() => recomputeAccent().then(() => toast.show('Accent resampled'))}>
        <IconRefresh size={15} stroke={1.75} /> Resample
      </button>
    </div>
  </section>

  <section class="pb-6">
    <h2 class="caps-header mb-2">Backup</h2>
    <p class="mb-3 text-[13px] text-ink2">A zip with every item, photo, look, plan and wear. Export → wipe → import gives back exactly what you had.</p>
    <div class="flex gap-3">
      <button class="btn-primary flex-1" onclick={() => saveBackup().catch(() => toast.show('Export failed'))}>
        <IconDownload size={16} stroke={2} /> Export zip
      </button>
      <button class="btn-ghost flex-1" disabled={importing} onclick={() => importInput.click()}>
        <IconUpload size={16} stroke={1.75} />
        {importing ? 'Importing…' : 'Import zip'}
      </button>
    </div>
    <input bind:this={importInput} type="file" accept=".zip,application/zip" class="hidden" onchange={onImport} />
  </section>
</div>
