<script lang="ts">
  import type { Photo } from '$lib/db/schema';
  import { blobUrl } from '$lib/images/urls';

  // §2 rule 4: cutouts (alpha PNGs from bg removal) centered with 12%
  // padding; plain photos cover-fit on a tile matte.
  let {
    photo,
    alt = '',
    full = false,
  }: { photo?: Photo; alt?: string; full?: boolean } = $props();

  const blob = $derived(photo ? (full ? photo.blob : photo.thumb) : undefined);
  const isCutout = $derived(blob?.type === 'image/png' || photo?.blob.type === 'image/png');
</script>

<div class="flex h-full w-full items-center justify-center overflow-hidden rounded-tile bg-tile">
  {#if photo && blob}
    {#if isCutout}
      <img
        src={blobUrl(photo.id + (full ? '' : ':t'), blob)}
        {alt}
        class="h-full w-full object-contain p-[12%]"
        loading="lazy"
      />
    {:else}
      <img
        src={blobUrl(photo.id + (full ? '' : ':t'), blob)}
        {alt}
        class="h-full w-full object-cover"
        loading="lazy"
      />
    {/if}
  {:else}
    <svg viewBox="0 0 24 24" class="h-8 w-8 text-ink3" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 4a2 2 0 1 1 2 2 2 2 0 0 0-2 2m0 0L4 14v3h16v-3l-8-6z" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  {/if}
</div>
