<script lang="ts">
  import { base } from '$app/paths';
  import { db, type Item, type Photo } from '$lib/db/schema';
  import { live } from '$lib/db/live';
  import { costPerWear, fmtMoney } from '$lib/db/repo';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import ItemTile from '$lib/components/ItemTile.svelte';
  import IconPlus from '@tabler/icons-svelte/icons/plus';
  import IconSearch from '@tabler/icons-svelte/icons/search';
  import IconX from '@tabler/icons-svelte/icons/x';

  const items = live<Item[]>(() => db.items.orderBy('updatedAt').reverse().toArray(), []);
  const mains = live<Photo[]>(() => db.photos.filter((p) => p.isMain).toArray(), []);
  const wears = live(() => db.wears.toArray(), []);
  const tags = live(() => db.tags.toArray(), []);

  let category = $state<string | null>(null);
  let tagId = $state<string | null>(null);
  let showArchived = $state(false);
  let search = $state('');
  let searchOpen = $state(false);

  const photoByItem = $derived(new Map($mains.map((p) => [p.itemId, p])));
  const wearCount = $derived(
    $wears.reduce((m, w) => m.set(w.itemId, (m.get(w.itemId) ?? 0) + 1), new Map<string, number>()),
  );
  const usedCategories = $derived([...new Set($items.map((i) => i.category))]);

  const filtered = $derived(
    $items.filter((i) => {
      if (i.archived !== showArchived) return false;
      if (category && i.category !== category) return false;
      if (tagId && !i.tagIds.includes(tagId)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!i.title.toLowerCase().includes(q) && !(i.brand ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    }),
  );

  function meta(item: Item): string {
    const n = wearCount.get(item.id) ?? 0;
    const cpw = costPerWear(item.price, n);
    return cpw != null ? `${n}× · ${fmtMoney(cpw)}/wear` : `${n}×`;
  }

  const archivedCount = $derived($items.filter((i) => i.archived).length);
</script>

<PageHeader title="Closet">
  <button class="press p-1 text-ink2" aria-label="Search" onclick={() => (searchOpen = !searchOpen)}>
    <IconSearch size={20} stroke={1.75} />
  </button>
  <a href="{base}/closet/add" class="press p-1 text-accent" aria-label="Add pieces">
    <IconPlus size={22} stroke={2} />
  </a>
</PageHeader>

{#if $items.length === 0}
  <EmptyState brand sentence="Your closet is empty. Add your first piece.">
    <a href="{base}/closet/add" class="btn-primary">Add a piece</a>
  </EmptyState>
{:else}
  {#if searchOpen}
    <div class="anim-fade px-4 pb-2">
      <div class="relative">
        <!-- svelte-ignore a11y_autofocus -->
        <input class="input-field pr-10" placeholder="Search title or brand" bind:value={search} autofocus />
        {#if search}
          <button
            class="press absolute top-1/2 right-3 -translate-y-1/2 text-ink3"
            aria-label="Clear search"
            onclick={() => (search = '')}><IconX size={16} /></button
          >
        {/if}
      </div>
    </div>
  {/if}

  <div class="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
    <button class="chip {!category && !tagId ? 'chip-active' : ''}" onclick={() => ((category = null), (tagId = null))}>
      all
    </button>
    {#each usedCategories as cat (cat)}
      <button
        class="chip {category === cat ? 'chip-active' : ''}"
        onclick={() => (category = category === cat ? null : cat)}
      >
        {cat}
      </button>
    {/each}
    {#each $tags as tag (tag.id)}
      <button class="chip {tagId === tag.id ? 'chip-active' : ''}" onclick={() => (tagId = tagId === tag.id ? null : tag.id)}>
        {tag.name}
      </button>
    {/each}
    {#if archivedCount > 0}
      <button class="chip {showArchived ? 'chip-active' : ''}" onclick={() => (showArchived = !showArchived)}>
        archived {archivedCount}
      </button>
    {/if}
  </div>

  {#if filtered.length === 0}
    <EmptyState sentence="Nothing matches. Loosen the filters." />
  {:else}
    <div class="grid grid-cols-2 gap-3 px-4">
      {#each filtered as item (item.id)}
        <ItemTile {item} photo={photoByItem.get(item.id)} href="{base}/closet/item?id={item.id}" meta={meta(item)} />
      {/each}
    </div>
    <p class="data px-4 pt-4 pb-2 text-center text-ink3">{filtered.length} pieces</p>
  {/if}
{/if}
