<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { db, type Item, type Look, type Photo } from '$lib/db/schema';
  import { live } from '$lib/db/live';
  import { addLook, deleteLook, updateLook } from '$lib/db/repo';
  import { toast } from '$lib/stores/toast.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import ItemTile from '$lib/components/ItemTile.svelte';
  import ItemPickerSheet from '$lib/components/ItemPickerSheet.svelte';
  import { blobUrl } from '$lib/images/urls';
  import IconArrowLeft from '@tabler/icons-svelte/icons/arrow-left';
  import IconPlus from '@tabler/icons-svelte/icons/plus';
  import IconTrash from '@tabler/icons-svelte/icons/trash';

  const id = $derived(page.url.searchParams.get('id'));
  const lookQ = $derived(live<Look | undefined>(() => (id ? db.looks.get(id) : undefined), undefined));
  const existing = $derived($lookQ);

  const items = live<Item[]>(() => db.items.toArray(), []);
  const mains = live<Photo[]>(() => db.photos.filter((p) => p.isMain).toArray(), []);
  const itemById = $derived(new Map($items.map((i) => [i.id, i])));
  const photoByItem = $derived(new Map($mains.map((p) => [p.itemId, p])));

  let title = $state('');
  let itemIds = $state<string[]>([]);
  let coverPhotoId = $state<string | undefined>(undefined);
  let picking = $state(false);
  let loadedFor = $state<string | null>(null);

  $effect(() => {
    if (existing && loadedFor !== existing.id) {
      title = existing.title;
      itemIds = [...existing.itemIds];
      coverPhotoId = existing.coverPhotoId;
      loadedFor = existing.id;
    }
  });

  // a removed item can't keep supplying the cover
  $effect(() => {
    if (coverPhotoId) {
      const owner = $mains.find((p) => p.id === coverPhotoId);
      if (owner && !itemIds.includes(owner.itemId)) coverPhotoId = undefined;
    }
  });

  const selectedItems = $derived(itemIds.map((i) => itemById.get(i)).filter((x): x is Item => !!x));

  async function save() {
    const name = title.trim() || 'Untitled look';
    if (existing) {
      await updateLook(existing.id, { title: name, itemIds, coverPhotoId });
      toast.show('Look saved');
      goto(`${base}/looks`);
    } else {
      await addLook(name, itemIds, coverPhotoId);
      toast.show('Look created');
      goto(`${base}/looks`);
    }
  }

  async function remove() {
    if (!existing) return;
    if (!confirm(`Delete “${existing.title}”?`)) return;
    await deleteLook(existing.id);
    goto(`${base}/looks`);
  }
</script>

<PageHeader title={existing ? 'Edit look' : 'New look'}>
  <a href="{base}/looks" class="press p-1 text-ink2" aria-label="Back to looks">
    <IconArrowLeft size={20} stroke={1.75} />
  </a>
</PageHeader>

<div class="flex flex-col gap-5 px-4">
  <input class="input-field" placeholder="Look title — e.g. Friday gallery" bind:value={title} />

  <div>
    <div class="mb-2 flex items-center justify-between">
      <p class="text-[13px] text-ink2">Pieces</p>
      <span class="data">{itemIds.length}</span>
    </div>
    <div class="grid grid-cols-3 gap-2">
      {#each selectedItems as item (item.id)}
        <ItemTile
          {item}
          photo={photoByItem.get(item.id)}
          onpress={() => (itemIds = itemIds.filter((i) => i !== item.id))}
        />
      {/each}
      <button
        class="press flex aspect-square items-center justify-center rounded-tile bg-tile text-ink3"
        aria-label="Add pieces"
        onclick={() => (picking = true)}
      >
        <IconPlus size={24} stroke={1.5} />
      </button>
    </div>
    {#if selectedItems.length}
      <p class="data mt-1.5 text-ink3">tap a piece to remove it</p>
    {/if}
  </div>

  {#if selectedItems.length > 1}
    <div>
      <p class="mb-2 text-[13px] text-ink2">Cover</p>
      <div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {#each selectedItems as item (item.id)}
          {@const p = photoByItem.get(item.id)}
          {#if p}
            <button
              class="press h-16 w-16 shrink-0 overflow-hidden rounded-tile bg-tile {coverPhotoId === p.id
                ? 'outline-2 outline-accent'
                : ''}"
              aria-label="Use {item.title} as cover"
              onclick={() => (coverPhotoId = coverPhotoId === p.id ? undefined : p.id)}
            >
              <img src={blobUrl(p.id + ':t', p.thumb)} alt="" class="h-full w-full object-cover" />
            </button>
          {/if}
        {/each}
      </div>
    </div>
  {/if}

  <button class="btn-primary w-full" disabled={itemIds.length === 0} onclick={save}>
    {existing ? 'Save look' : 'Create look'}
  </button>

  {#if existing}
    <button class="btn-ghost w-full text-[13px] text-danger" onclick={remove}>
      <IconTrash size={16} stroke={1.75} /> Delete look
    </button>
  {/if}
</div>

<ItemPickerSheet bind:open={picking} bind:selected={itemIds} title="Pick pieces" />
