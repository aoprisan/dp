<script lang="ts">
  import type { Item, Photo } from '$lib/db/schema';
  import ItemPhoto from './ItemPhoto.svelte';
  import IconCheck from '@tabler/icons-svelte/icons/check';

  let {
    item,
    photo,
    href,
    meta,
    selected,
    onpress,
  }: {
    item: Item;
    photo?: Photo;
    href?: string;
    /** mono data line, e.g. `7× · €4/wear` */
    meta?: string;
    selected?: boolean;
    onpress?: () => void;
  } = $props();
</script>

{#snippet body()}
  <div class="relative aspect-square w-full">
    <ItemPhoto {photo} alt={item.title} />
    {#if selected !== undefined}
      <div
        class="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full {selected
          ? 'bg-accent text-ground'
          : 'bg-ground/70 text-transparent'}"
      >
        <IconCheck size={15} stroke={2.5} />
      </div>
    {/if}
    {#if item.archived}
      <span class="data absolute bottom-2 left-2 rounded-full bg-ground/80 px-2 py-0.5">archived</span>
    {/if}
  </div>
  <div class="px-0.5 pt-1.5 text-left">
    <p class="truncate text-[13px] leading-snug text-ink">{item.title}</p>
    {#if meta}<p class="data mt-0.5 truncate">{meta}</p>{/if}
  </div>
{/snippet}

{#if href}
  <a {href} class="press block w-full">{@render body()}</a>
{:else}
  <button type="button" class="press block w-full" onclick={onpress}>{@render body()}</button>
{/if}
