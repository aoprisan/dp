<script lang="ts">
  import { db, type Item, type Photo } from '$lib/db/schema';
  import { live } from '$lib/db/live';
  import Sheet from './Sheet.svelte';
  import ItemTile from './ItemTile.svelte';

  let {
    open = $bindable(false),
    selected = $bindable<string[]>([]),
    title = 'Pick pieces',
  }: { open?: boolean; selected?: string[]; title?: string } = $props();

  const items = live<Item[]>(() => db.items.filter((i) => !i.archived).toArray(), []);
  const mains = live<Photo[]>(() => db.photos.filter((p) => p.isMain).toArray(), []);
  const photoByItem = $derived(new Map($mains.map((p) => [p.itemId, p])));

  function toggle(id: string) {
    selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
  }
</script>

<Sheet bind:open {title}>
  {#if $items.length === 0}
    <p class="py-8 text-center text-[15px] text-ink2">Nothing in your closet yet.</p>
  {:else}
    <div class="grid grid-cols-3 gap-2">
      {#each $items as item (item.id)}
        <ItemTile
          {item}
          photo={photoByItem.get(item.id)}
          selected={selected.includes(item.id)}
          onpress={() => toggle(item.id)}
        />
      {/each}
    </div>
  {/if}
  <button class="btn-primary mt-4 w-full" onclick={() => (open = false)}>
    Done{selected.length ? ` · ${selected.length}` : ''}
  </button>
</Sheet>
