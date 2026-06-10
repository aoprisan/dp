<script lang="ts">
  import { base } from '$app/paths';
  import { db, type Item } from '$lib/db/schema';
  import { live } from '$lib/db/live';
  import { costPerWear, fmtMoney } from '$lib/db/repo';
  import { colorName } from '$lib/images/color';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import IconArrowLeft from '@tabler/icons-svelte/icons/arrow-left';

  const items = live<Item[]>(() => db.items.toArray(), []);
  const wears = live(() => db.wears.toArray(), []);
  const looks = live(() => db.looks.toArray(), []);
  const tags = live(() => db.tags.toArray(), []);

  const active = $derived($items.filter((i) => !i.archived));
  const wearCount = $derived(
    $wears.reduce((m, w) => m.set(w.itemId, (m.get(w.itemId) ?? 0) + 1), new Map<string, number>()),
  );

  const totalValue = $derived(active.reduce((s, i) => s + (i.price ?? 0), 0));
  const totalWears = $derived($wears.length);

  const priced = $derived(active.filter((i) => i.price != null));
  const avgCpw = $derived(
    priced.length
      ? priced.reduce((s, i) => s + (costPerWear(i.price, wearCount.get(i.id) ?? 0) ?? 0), 0) / priced.length
      : undefined,
  );

  const byWears = $derived(
    [...active].sort((a, b) => (wearCount.get(b.id) ?? 0) - (wearCount.get(a.id) ?? 0)),
  );
  const mostWorn = $derived(byWears.filter((i) => (wearCount.get(i.id) ?? 0) > 0).slice(0, 5));
  const leastWorn = $derived(
    byWears
      .filter((i) => (wearCount.get(i.id) ?? 0) > 0)
      .slice(-5)
      .reverse()
      .filter((i) => !mostWorn.includes(i)),
  );
  const neverWorn = $derived(active.filter((i) => !(wearCount.get(i.id) ?? 0)));

  function breakdown(keyFn: (i: Item) => string[]): { label: string; count: number }[] {
    const m = new Map<string, number>();
    for (const i of active) for (const k of keyFn(i)) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }

  const tagName = $derived(new Map($tags.map((t) => [t.id, t.name])));
  const byCategory = $derived(breakdown((i) => [i.category]));
  const byTag = $derived(breakdown((i) => i.tagIds.map((t) => tagName.get(t) ?? '?')));
  const byColor = $derived(breakdown((i) => (i.colors[0] ? [colorName(i.colors[0])] : [])));

  const maxCat = $derived(Math.max(1, ...byCategory.map((b) => b.count)));
  const maxTag = $derived(Math.max(1, ...byTag.map((b) => b.count)));
  const maxColor = $derived(Math.max(1, ...byColor.map((b) => b.count)));

  function cpwLabel(i: Item): string {
    const n = wearCount.get(i.id) ?? 0;
    const cpw = costPerWear(i.price, n);
    return cpw != null ? `${n}× · ${fmtMoney(cpw)}/wear` : `${n}×`;
  }
</script>

{#snippet bars(rows: { label: string; count: number }[], max: number)}
  <div class="flex flex-col gap-2">
    {#each rows as row (row.label)}
      <div class="flex items-center gap-3">
        <span class="w-24 shrink-0 truncate text-[13px] text-ink2">{row.label}</span>
        <div class="h-2 flex-1 overflow-hidden rounded-full bg-tile">
          <div class="h-full rounded-full bg-ink" style="width:{(row.count / max) * 100}%"></div>
        </div>
        <span class="data w-8 text-right">{row.count}</span>
      </div>
    {/each}
  </div>
{/snippet}

{#snippet itemRow(item: Item)}
  <a
    href="{base}/closet/item?id={item.id}"
    class="press flex items-center justify-between rounded-tile px-3 py-2.5 hover:bg-tile"
  >
    <span class="truncate text-[14px] text-ink">{item.title}</span>
    <span class="data ml-3 shrink-0">{cpwLabel(item)}</span>
  </a>
{/snippet}

<PageHeader title="Stats">
  <a href="{base}/more" class="press p-1 text-ink2" aria-label="Back">
    <IconArrowLeft size={20} stroke={1.75} />
  </a>
</PageHeader>

{#if active.length === 0}
  <EmptyState sentence="Stats need a closet. Add some pieces first.">
    <a href="{base}/closet/add" class="btn-primary">Add pieces</a>
  </EmptyState>
{:else}
  <div class="flex flex-col gap-6 px-4">
    <div class="grid grid-cols-2 gap-3">
      {#each [
        { label: 'pieces', value: String(active.length) },
        { label: 'value', value: fmtMoney(totalValue) },
        { label: 'wears', value: `${totalWears}×` },
        { label: 'looks', value: String($looks.length) },
      ] as m (m.label)}
        <div class="rounded-card bg-tile px-4 py-3">
          <p class="font-mono text-[22px] text-ink" style="font-variant-numeric: tabular-nums">{m.value}</p>
          <p class="data text-ink3">{m.label}</p>
        </div>
      {/each}
    </div>

    {#if avgCpw != null}
      <p class="data text-center">average {fmtMoney(avgCpw)}/wear across {priced.length} priced pieces</p>
    {/if}

    {#if neverWorn.length}
      <section>
        <h2 class="caps-header mb-2">Never worn</h2>
        <div class="rounded-card bg-accent-soft py-1">
          {#each neverWorn.slice(0, 8) as item (item.id)}
            {@render itemRow(item)}
          {/each}
          {#if neverWorn.length > 8}
            <p class="data px-3 pb-2 text-ink3">+ {neverWorn.length - 8} more</p>
          {/if}
        </div>
      </section>
    {/if}

    {#if mostWorn.length}
      <section>
        <h2 class="caps-header mb-2">Most worn</h2>
        {#each mostWorn as item (item.id)}
          {@render itemRow(item)}
        {/each}
      </section>
    {/if}

    {#if leastWorn.length}
      <section>
        <h2 class="caps-header mb-2">Least worn</h2>
        {#each leastWorn as item (item.id)}
          {@render itemRow(item)}
        {/each}
      </section>
    {/if}

    <section>
      <h2 class="caps-header mb-3">By category</h2>
      {@render bars(byCategory, maxCat)}
    </section>

    {#if byTag.length}
      <section>
        <h2 class="caps-header mb-3">By tag</h2>
        {@render bars(byTag.slice(0, 10), maxTag)}
      </section>
    {/if}

    {#if byColor.length}
      <section class="pb-4">
        <h2 class="caps-header mb-3">By color</h2>
        {@render bars(byColor, maxColor)}
      </section>
    {/if}
  </div>
{/if}
