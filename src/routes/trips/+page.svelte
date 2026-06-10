<script lang="ts">
  import { base } from '$app/paths';
  import { db, type Trip } from '$lib/db/schema';
  import { live } from '$lib/db/live';
  import { todayStr } from '$lib/db/repo';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import IconArrowLeft from '@tabler/icons-svelte/icons/arrow-left';
  import IconPlus from '@tabler/icons-svelte/icons/plus';
  import IconMapPin from '@tabler/icons-svelte/icons/map-pin';

  const trips = live<Trip[]>(() => db.trips.orderBy('start').reverse().toArray(), []);
  const today = todayStr();

  const upcoming = $derived($trips.filter((t) => t.end >= today).reverse());
  const past = $derived($trips.filter((t) => t.end < today));
</script>

<PageHeader title="Trips">
  <a href="{base}/more" class="press p-1 text-ink2" aria-label="Back">
    <IconArrowLeft size={20} stroke={1.75} />
  </a>
  <a href="{base}/trips/trip" class="press p-1 text-accent" aria-label="New trip">
    <IconPlus size={22} stroke={2} />
  </a>
</PageHeader>

{#if $trips.length === 0}
  <EmptyState sentence="No trips planned. Pack from what you own.">
    <a href="{base}/trips/trip" class="btn-primary">Plan a trip</a>
  </EmptyState>
{:else}
  <div class="flex flex-col gap-6 px-4">
    {#each [
      { label: 'Upcoming', list: upcoming },
      { label: 'Past', list: past },
    ] as group (group.label)}
      {#if group.list.length}
        <section>
          <h2 class="caps-header mb-2">{group.label}</h2>
          <div class="flex flex-col gap-2">
            {#each group.list as trip (trip.id)}
              <a href="{base}/trips/trip?id={trip.id}" class="press rounded-card bg-tile px-4 py-3.5">
                <div class="flex items-center justify-between">
                  <span class="text-[15px] font-medium text-ink">{trip.title}</span>
                  <span class="data">{trip.packed.length}/{trip.itemIds.length} packed</span>
                </div>
                <div class="mt-1 flex items-center gap-1.5 text-ink2">
                  <IconMapPin size={13} stroke={1.75} />
                  <span class="text-[13px]">{trip.place}</span>
                  <span class="data ml-auto">{trip.start} → {trip.end}</span>
                </div>
              </a>
            {/each}
          </div>
        </section>
      {/if}
    {/each}
  </div>
{/if}
