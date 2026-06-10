<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { compressPhoto, compressCutout } from '$lib/images/compress';
  import { removeBg } from '$lib/images/bgRemove';
  import { extractColors } from '$lib/images/palette';
  import { addItem } from '$lib/db/repo';
  import { toast } from '$lib/stores/toast.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import ItemForm, { emptyDraft, draftFields, type ItemFormDraft } from '$lib/components/ItemForm.svelte';
  import IconCamera from '@tabler/icons-svelte/icons/camera';
  import IconPhoto from '@tabler/icons-svelte/icons/photo';
  import IconWand from '@tabler/icons-svelte/icons/wand';
  import IconTrash from '@tabler/icons-svelte/icons/trash';
  import IconArrowLeft from '@tabler/icons-svelte/icons/arrow-left';

  interface QueueEntry {
    blob: Blob;
    thumb: Blob;
    removed?: { blob: Blob; thumb: Blob };
    useRemoved: boolean;
  }

  let queue = $state<QueueEntry[]>([]);
  let index = $state(0);
  let draft = $state<ItemFormDraft>(emptyDraft());
  let preparing = $state(false);
  let removing = $state(false);
  let saving = $state(false);
  let savedCount = $state(0);
  let fileInput: HTMLInputElement;
  let cameraInput: HTMLInputElement;

  const current = $derived(queue[index]);
  const activeBlob = $derived(current?.useRemoved && current.removed ? current.removed.blob : current?.blob);
  let previewUrl = $state<string | null>(null);
  $effect(() => {
    if (!activeBlob) {
      previewUrl = null;
      return;
    }
    const url = URL.createObjectURL(activeBlob);
    previewUrl = url;
    return () => URL.revokeObjectURL(url);
  });

  async function onFiles(e: Event) {
    const files = [...((e.target as HTMLInputElement).files ?? [])];
    if (!files.length) return;
    preparing = true;
    try {
      // Bulk-add queue (§P1): shoot N photos, annotate one by one.
      for (const f of files) {
        const { blob, thumb } = await compressPhoto(f);
        queue.push({ blob, thumb, useRemoved: false });
      }
    } catch (err) {
      console.error(err);
      toast.show('Could not read some photos');
    } finally {
      preparing = false;
      (e.target as HTMLInputElement).value = '';
    }
  }

  async function toggleBg() {
    if (!current) return;
    if (current.removed) {
      current.useRemoved = !current.useRemoved;
      return;
    }
    removing = true;
    try {
      const cutout = await removeBg(current.blob);
      current.removed = await compressCutout(cutout);
      current.useRemoved = true;
    } catch (err) {
      console.error(err);
      toast.show('Background removal failed');
    } finally {
      removing = false;
    }
  }

  function advance() {
    queue.splice(index, 1);
    const carry = draft;
    draft = { ...emptyDraft(), category: carry.category, warmth: carry.warmth, formality: carry.formality };
    if (queue.length === 0) {
      toast.show(savedCount ? `${savedCount} ${savedCount === 1 ? 'piece' : 'pieces'} added` : 'Done');
      goto(`${base}/closet`);
    } else if (index >= queue.length) {
      index = queue.length - 1;
    }
  }

  async function save() {
    if (!current || saving) return;
    saving = true;
    try {
      const photo = current.useRemoved && current.removed ? current.removed : { blob: current.blob, thumb: current.thumb };
      const colors = (await extractColors(photo.blob)).slice(0, 3);
      await addItem({ ...draftFields(draft), colors, archived: false }, [photo]);
      savedCount += 1;
      advance();
    } catch (err) {
      console.error(err);
      toast.show('Could not save');
    } finally {
      saving = false;
    }
  }
</script>

<PageHeader title="Add pieces">
  <a href="{base}/closet" class="press p-1 text-ink2" aria-label="Back to closet">
    <IconArrowLeft size={20} stroke={1.75} />
  </a>
</PageHeader>

<input
  bind:this={fileInput}
  type="file"
  accept="image/*"
  multiple
  class="hidden"
  onchange={onFiles}
/>
<input
  bind:this={cameraInput}
  type="file"
  accept="image/*"
  capture="environment"
  class="hidden"
  onchange={onFiles}
/>

{#if !current}
  <div class="anim-fade flex flex-col items-center gap-5 px-8 pt-20 text-center">
    <p class="text-[15px] text-ink2">
      {preparing ? 'Preparing photos…' : 'Shoot or pick photos — then annotate them one by one.'}
    </p>
    <button class="btn-primary" disabled={preparing} onclick={() => cameraInput.click()}>
      <IconCamera size={18} stroke={2} /> Take photo
    </button>
    <button class="btn-ghost" disabled={preparing} onclick={() => fileInput.click()}>
      <IconPhoto size={18} stroke={1.75} /> Pick from library
    </button>
  </div>
{:else}
  <div class="flex flex-col gap-4 px-4">
    <div class="flex items-center justify-between">
      <span class="data">{savedCount + 1} / {savedCount + queue.length}</span>
      <div class="flex items-center gap-3">
        <button class="press p-1 text-ink3" aria-label="Take another photo" disabled={preparing} onclick={() => cameraInput.click()}>
          <IconCamera size={18} stroke={1.75} />
        </button>
        <button class="press p-1 text-ink3" aria-label="Pick more photos" disabled={preparing} onclick={() => fileInput.click()}>
          <IconPhoto size={18} stroke={1.75} />
        </button>
        <button class="press p-1 text-ink3" aria-label="Skip this photo" onclick={advance}>
          <IconTrash size={18} stroke={1.75} />
        </button>
      </div>
    </div>

    <div class="relative aspect-square w-full overflow-hidden rounded-card bg-tile">
      {#if previewUrl}
        <img
          src={previewUrl}
          alt="New piece"
          class="h-full w-full {activeBlob && current.useRemoved ? 'object-contain p-[12%]' : 'object-cover'}"
        />
      {/if}
      <button
        class="press absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-ground/85 px-3 py-1.5 text-[13px] font-medium {current.useRemoved
          ? 'text-accent'
          : 'text-ink2'}"
        disabled={removing}
        onclick={toggleBg}
      >
        <IconWand size={15} stroke={1.75} />
        {removing ? 'Removing…' : current.useRemoved ? 'Cutout on' : 'Remove bg'}
      </button>
    </div>

    <ItemForm bind:draft />

    <button class="btn-primary w-full" disabled={saving} onclick={save}>
      {saving ? 'Saving…' : queue.length > 1 ? 'Save & next' : 'Save'}
    </button>
  </div>
{/if}
