<script lang="ts">
  import { base } from '$app/paths';
  import { db } from '$lib/db/schema';
  import { live } from '$lib/db/live';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import IconChartBar from '@tabler/icons-svelte/icons/chart-bar';
  import IconLuggage from '@tabler/icons-svelte/icons/luggage';
  import IconSettings from '@tabler/icons-svelte/icons/settings';
  import IconChevronRight from '@tabler/icons-svelte/icons/chevron-right';

  const itemCount = live(() => db.items.count(), 0);
  const tripCount = live(() => db.trips.count(), 0);

  const rows = $derived([
    { href: '/stats', label: 'Stats', icon: IconChartBar, meta: `${$itemCount} pieces` },
    { href: '/trips', label: 'Trips', icon: IconLuggage, meta: $tripCount ? `${$tripCount}` : '' },
    { href: '/settings', label: 'Settings', icon: IconSettings, meta: '' },
  ]);
</script>

<PageHeader title="More" />

<div class="flex flex-col gap-2 px-4">
  {#each rows as row (row.href)}
    <a href="{base}{row.href}" class="press flex items-center gap-3 rounded-card bg-tile px-4 py-4">
      <row.icon size={20} stroke={1.75} />
      <span class="flex-1 text-[15px] font-medium text-ink">{row.label}</span>
      {#if row.meta}<span class="data">{row.meta}</span>{/if}
      <IconChevronRight size={16} stroke={1.75} class="text-ink3" />
    </a>
  {/each}
</div>
