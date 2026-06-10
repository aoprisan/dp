<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { db, type Item, type Photo } from '$lib/db/schema';
  import { live } from '$lib/db/live';
  import {
    addPhotos,
    costPerWear,
    deleteItem,
    deletePhoto,
    fmtMoney,
    replacePhotoBlob,
    setMainPhoto,
    updateItem,
    woreToday,
  } from '$lib/db/repo';
  import { compressPhoto, compressCutout } from '$lib/images/compress';
  import { removeBg } from '$lib/images/bgRemove';
  import { extractColors } from '$lib/images/palette';
  import { recomputeAccent } from '$lib/stores/accent';
  import { blobUrl } from '$lib/images/urls';
  import { toast } from '$lib/stores/toast.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import ItemForm, { draftFromItem, draftFields, emptyDraft, type ItemFormDraft } from '$lib/components/ItemForm.svelte';
  import IconArrowLeft from '@tabler/icons-svelte/icons/arrow-left';
  import IconCamera from '@tabler/icons-svelte/icons/camera';
  import IconPhoto from '@tabler/icons-svelte/icons/photo';
  import IconTrash from '@tabler/icons-svelte/icons/trash';
  import IconWand from '@tabler/icons-svelte/icons/wand';
  import IconStarFilled from '@tabler/icons-svelte/icons/star-filled';
  import IconStar from '@tabler/icons-svelte/icons/star';
  import IconArchive from '@tabler/icons-svelte/icons/archive';
  import IconCircleCheck from '@tabler/icons-svelte/icons/circle-check';

  const id = $derived(page.url.searchParams.get('id') ?? '');

  const itemQ = $derived(live<Item | undefined>(() => db.items.get(id), undefined));
  const item = $derived($itemQ);
  const photosQ = $derived(live<Photo[]>(() => db.photos.where('itemId').equals(id).sortBy('order'), []));
  const photos = $derived($photosQ);
  const wearsQ = $derived(live(() => db.wears.where('itemId').equals(id).toArray(), []));
  const wears = $derived($wearsQ);

  let draft = $state<ItemFormDraft>(emptyDraft());
  let loadedFor = $state('');
  $effect(() => {
    if (item && loadedFor !== item.id) {
      draft = draftFromItem(item);
      loadedFor = item.id;
    }
  });

  let saving = $state(false);
  let removingId = $state<string | null>(null);
  let fileInput: HTMLInputElement;
  let cameraInput: HTMLInputElement;

  const wearCount = $derived(wears.length);
  const lastWorn = $derived(wears.map((w) => w.date).sort().at(-1));
  const cpw = $derived(item ? costPerWear(item.price, wearCount) : undefined);

  async function save() {
    if (!item || saving) return;
    saving = true;
    try {
      await updateItem(item.id, draftFields(draft));
      toast.show('Saved');
    } finally {
      saving = false;
    }
  }

  async function onAddPhotos(e: Event) {
    const files = [...((e.target as HTMLInputElement).files ?? [])];
    if (!files.length || !item) return;
    const prepared = [];
    for (const f of files) prepared.push(await compressPhoto(f));
    await addPhotos(item.id, prepared);
    (e.target as HTMLInputElement).value = '';
  }

  async function cutout(photo: Photo) {
    if (!item || removingId) return;
    removingId = photo.id;
    try {
      const removed = await removeBg(photo.blob);
      const { blob, thumb } = await compressCutout(removed);
      await replacePhotoBlob(photo.id, blob, thumb);
      if (photo.isMain) {
        const colors = (await extractColors(blob)).slice(0, 3);
        await updateItem(item.id, { colors });
        void recomputeAccent();
      }
    } catch (err) {
      console.error(err);
      toast.show('Background removal failed');
    } finally {
      removingId = null;
    }
  }

  async function wore() {
    if (!item) return;
    await woreToday(item.id);
    toast.show('Wear recorded for today');
  }

  async function toggleArchive() {
    if (!item) return;
    await updateItem(item.id, { archived: !item.archived });
    void recomputeAccent();
  }

  async function remove() {
    if (!item) return;
    if (!confirm(`Delete “${item.title}” and its photos?`)) return;
    await deleteItem(item.id);
    goto(`${base}/closet`);
  }
</script>

<PageHeader title="Piece">
  <a href="{base}/closet" class="press p-1 text-ink2" aria-label="Back to closet">
    <IconArrowLeft size={20} stroke={1.75} />
  </a>
</PageHeader>

<input bind:this={fileInput} type="file" accept="image/*" multiple class="hidden" onchange={onAddPhotos} />
<input bind:this={cameraInput} type="file" accept="image/*" capture="environment" class="hidden" onchange={onAddPhotos} />

{#if !item}
  <p class="px-4 pt-10 text-center text-[15px] text-ink2">This piece doesn't exist anymore.</p>
{:else}
  <div class="flex flex-col gap-5 px-4">
    <div class="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4">
      {#each photos as photo (photo.id)}
        <div class="relative aspect-square w-[80%] shrink-0 snap-center overflow-hidden rounded-card bg-tile">
          <img
            src={blobUrl(photo.id, photo.blob)}
            alt={item.title}
            class="h-full w-full {photo.blob.type === 'image/png' ? 'object-contain p-[12%]' : 'object-cover'}"
          />
          <div class="absolute inset-x-3 bottom-3 flex items-center justify-between">
            <button
              class="press flex h-8 w-8 items-center justify-center rounded-full bg-ground/85 {photo.isMain ? 'text-accent' : 'text-ink3'}"
              aria-label={photo.isMain ? 'Main photo' : 'Make main photo'}
              onclick={() => setMainPhoto(photo.id)}
            >
              {#if photo.isMain}<IconStarFilled size={15} />{:else}<IconStar size={15} stroke={1.75} />{/if}
            </button>
            <div class="flex gap-2">
              <button
                class="press flex h-8 items-center gap-1 rounded-full bg-ground/85 px-3 text-[12px] font-medium text-ink2"
                disabled={removingId !== null}
                onclick={() => cutout(photo)}
              >
                <IconWand size={14} stroke={1.75} />
                {removingId === photo.id ? '…' : 'cutout'}
              </button>
              {#if photos.length > 1}
                <button
                  class="press flex h-8 w-8 items-center justify-center rounded-full bg-ground/85 text-ink3"
                  aria-label="Delete photo"
                  onclick={() => deletePhoto(photo.id)}
                >
                  <IconTrash size={14} stroke={1.75} />
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
      <div class="flex aspect-square w-[30%] shrink-0 snap-center flex-col gap-2">
        <button
          class="press flex flex-1 items-center justify-center rounded-card bg-tile text-ink3"
          aria-label="Take photo"
          onclick={() => cameraInput.click()}
        >
          <IconCamera size={22} stroke={1.5} />
        </button>
        <button
          class="press flex flex-1 items-center justify-center rounded-card bg-tile text-ink3"
          aria-label="Add photos from library"
          onclick={() => fileInput.click()}
        >
          <IconPhoto size={22} stroke={1.5} />
        </button>
      </div>
    </div>

    <div class="flex items-center justify-between rounded-card bg-tile px-4 py-3">
      <div class="flex flex-col gap-0.5">
        <span class="data">
          worn {wearCount}×{cpw != null ? ` · ${fmtMoney(cpw)}/wear` : ''}
        </span>
        {#if lastWorn}<span class="data text-ink3">last {lastWorn}</span>{/if}
        {#if item.colors.length}
          <span class="mt-1 flex gap-1.5">
            {#each item.colors as c (c)}
              <span class="inline-block h-3.5 w-3.5 rounded-full" style="background:{c}"></span>
            {/each}
          </span>
        {/if}
      </div>
      <button class="press flex items-center gap-1.5 rounded-tile bg-tile2 px-3.5 py-2.5 text-[13px] font-medium text-ink" onclick={wore}>
        <IconCircleCheck size={16} stroke={1.75} /> Wore it today
      </button>
    </div>

    <ItemForm bind:draft />

    <button class="btn-primary w-full" disabled={saving} onclick={save}>Save changes</button>

    <div class="flex gap-3 pb-4">
      <button class="btn-ghost flex-1 text-[13px]" onclick={toggleArchive}>
        <IconArchive size={16} stroke={1.75} />
        {item.archived ? 'Unarchive' : 'Archive'}
      </button>
      <button class="btn-ghost flex-1 text-[13px] text-danger" onclick={remove}>
        <IconTrash size={16} stroke={1.75} /> Delete
      </button>
    </div>
  </div>
{/if}
