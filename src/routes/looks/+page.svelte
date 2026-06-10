<script lang="ts">
  import { base } from '$app/paths';
  import { db, type Look, type Photo } from '$lib/db/schema';
  import { live } from '$lib/db/live';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import LookCard from '$lib/components/LookCard.svelte';
  import IconPlus from '@tabler/icons-svelte/icons/plus';

  const looks = live<Look[]>(() => db.looks.orderBy('updatedAt').reverse().toArray(), []);
  const photos = live<Photo[]>(() => db.photos.toArray(), []);

  const photoById = $derived(new Map($photos.map((p) => [p.id, p])));
  const mainByItem = $derived(new Map($photos.filter((p) => p.isMain).map((p) => [p.itemId, p])));

  function itemPhotos(look: Look): Photo[] {
    return look.itemIds.map((id) => mainByItem.get(id)).filter((p): p is Photo => !!p);
  }
</script>

<PageHeader title="Looks">
  <a href="{base}/looks/edit" class="press p-1 text-accent" aria-label="New look">
    <IconPlus size={22} stroke={2} />
  </a>
</PageHeader>

{#if $looks.length === 0}
  <EmptyState sentence="No looks yet. Combine pieces you own into one.">
    <a href="{base}/looks/edit" class="btn-primary">Build a look</a>
  </EmptyState>
{:else}
  <div class="grid grid-cols-2 gap-3 px-4">
    {#each $looks as look, i (look.id)}
      <div class={i === 0 ? 'col-span-2' : ''}>
        <LookCard
          {look}
          cover={look.coverPhotoId ? photoById.get(look.coverPhotoId) : undefined}
          itemPhotos={itemPhotos(look)}
          href="{base}/looks/edit?id={look.id}"
          hero={i === 0}
        />
      </div>
    {/each}
  </div>
{/if}
