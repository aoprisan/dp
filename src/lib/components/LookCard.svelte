<script lang="ts">
  import type { Look, Photo } from '$lib/db/schema';
  import ItemPhoto from './ItemPhoto.svelte';
  import { blobUrl } from '$lib/images/urls';

  let {
    look,
    cover,
    itemPhotos,
    href,
    hero = false,
  }: {
    look: Look;
    /** explicit cover photo, if set */
    cover?: Photo;
    /** main photos of the look's items, for the composite fallback */
    itemPhotos: Photo[];
    href: string;
    hero?: boolean;
  } = $props();

  const composite = $derived(itemPhotos.slice(0, 4));
</script>

<a {href} class="press block w-full">
  <div class="aspect-square w-full overflow-hidden rounded-card bg-tile">
    {#if cover}
      <img
        src={blobUrl(cover.id, hero ? cover.blob : cover.thumb)}
        alt={look.title}
        class="h-full w-full {cover.blob.type === 'image/png' ? 'object-contain p-[10%]' : 'object-cover'}"
        loading="lazy"
      />
    {:else if composite.length}
      <div class="grid h-full w-full grid-cols-2 gap-1 p-1">
        {#each composite as p (p.id)}
          <ItemPhoto photo={p} alt="" />
        {/each}
        {#each { length: Math.max(0, (composite.length <= 2 ? 2 : 4) - composite.length) } as _, i (i)}
          <div class="rounded-tile bg-tile2"></div>
        {/each}
      </div>
    {:else}
      <div class="flex h-full items-center justify-center text-ink3">
        <span class="text-[13px]">no pieces</span>
      </div>
    {/if}
  </div>
  <div class="px-0.5 pt-1.5">
    <p class="truncate {hero ? 'text-[15px]' : 'text-[13px]'} text-ink">{look.title}</p>
    <p class="data mt-0.5">{look.itemIds.length} {look.itemIds.length === 1 ? 'piece' : 'pieces'}</p>
  </div>
</a>
