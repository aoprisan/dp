<script lang="ts">
  import { wardrobe, photoURL } from '$lib/wardrobe.svelte.js';
  import { toast } from '$lib/toast.svelte.js';
  import { fmtNo } from '$lib/utils';
  import type { Privacy } from '$lib/types';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open = $bindable(), onclose }: Props = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let title = $state('');
  let description = $state('');
  let privacy = $state<Privacy>('public');
  let newTagInput = $state('');
  let dragging = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();
  let saving = $state(false);

  $effect(() => {
    if (!dialog) return;
    if (open) {
      const item = wardrobe.editingItem;
      title = item?.title ?? '';
      description = item?.description ?? '';
      privacy = item?.privacy ?? 'public';
      newTagInput = '';
      dialog.showModal();
    } else {
      dialog.close();
    }
  });

  function handleClose() {
    open = false;
    wardrobe.closeEditor();
    onclose();
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.show('A piece needs a title.');
      return;
    }
    saving = true;
    try {
      const item = await wardrobe.saveItem({ title: title.trim(), description: description.trim(), privacy });
      const label = wardrobe.editingId ? 'Revised' : 'Filed';
      toast.show(`${label} — <span class="accent">${fmtNo(item.no)}</span>`);
      open = false;
      wardrobe.closeEditor();
      onclose();
    } finally {
      saving = false;
    }
  }

  async function handleFiles(files: FileList | File[] | null) {
    if (!files) return;
    try {
      await wardrobe.addDraftPhotos(files);
    } catch {
      toast.show("Couldn't read that photograph.");
    }
  }

  async function createTag() {
    const name = newTagInput.trim();
    if (!name) return;
    const tag = await wardrobe.createTag(name);
    wardrobe.toggleDraftTag(tag.id);
    // Ensure it's selected (createTag may return existing tag already selected)
    if (!wardrobe.draftTagIds.has(tag.id)) wardrobe.toggleDraftTag(tag.id);
    newTagInput = '';
  }

  const kicker = $derived(wardrobe.editingItem ? `Revising ${fmtNo(wardrobe.editingItem.no)}` : 'New entry');
  const heading = $derived(wardrobe.editingItem ? 'Revise the Piece' : 'Add a Piece');
  const submitLabel = $derived(wardrobe.editingItem ? 'File the revision' : 'File into the archive');
</script>

<dialog
  class="sheet"
  bind:this={dialog}
  onclose={handleClose}
>
  <form class="sheet__frame" onsubmit={handleSubmit} novalidate>
    <header class="sheet__head">
      <div>
        <span class="kicker mono">{kicker}</span>
        <h2>{heading}</h2>
      </div>
      <button type="button" class="btn-close" aria-label="Close" onclick={handleClose}>✕</button>
    </header>

    <div class="sheet__body">

      <!-- 01 Photographs -->
      <div class="field">
        <span class="field__label"><span class="index">01</span> Photographs</span>
        <button
          type="button"
          class="photo-drop"
          class:dragover={dragging}
          onclick={() => fileInput?.click()}
          ondragover={(e) => { e.preventDefault(); dragging = true; }}
          ondragleave={() => { dragging = false; }}
          ondrop={(e) => { e.preventDefault(); dragging = false; handleFiles(e.dataTransfer?.files ?? null); }}
        >
          <span class="big">+</span>
          Add photographs
        </button>
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          bind:this={fileInput}
          onchange={(e) => { handleFiles((e.target as HTMLInputElement).files); (e.target as HTMLInputElement).value = ''; }}
        />

        {#if wardrobe.draftPhotos.length > 0}
          <div class="photo-strip">
            {#each wardrobe.draftPhotos as photo, i}
              <div class="thumb">
                <img src={photoURL(photo)} alt="" />
                <button
                  type="button"
                  class="thumb__remove"
                  aria-label="Remove photograph"
                  onclick={() => wardrobe.removeDraftPhoto(i)}
                >✕</button>
                <button
                  type="button"
                  class="thumb__cover"
                  class:is-cover={i === 0}
                  onclick={() => wardrobe.setCoverPhoto(i)}
                >
                  {i === 0 ? 'cover' : 'set cover'}
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- 02 Title -->
      <div class="field">
        <label class="field__label" for="f-title">
          <span class="index">02</span> Title
        </label>
        <input
          id="f-title"
          type="text"
          class="input-title"
          placeholder="Linen overshirt"
          autocomplete="off"
          bind:value={title}
        />
      </div>

      <!-- 03 Notes -->
      <div class="field">
        <label class="field__label" for="f-desc">
          <span class="index">03</span> Notes <span class="opt">optional</span>
        </label>
        <textarea
          id="f-desc"
          rows="2"
          placeholder="Fabric, fit, where it came from…"
          bind:value={description}
        ></textarea>
      </div>

      <!-- 04 Tags -->
      <div class="field">
        <span class="field__label"><span class="index">04</span> Tags <span class="opt">optional</span></span>
        {#if wardrobe.tags.length > 0}
          <div class="tag-picker">
            {#each wardrobe.tags as tag}
              <button
                type="button"
                class="chip"
                aria-pressed={wardrobe.draftTagIds.has(tag.id)}
                onclick={() => wardrobe.toggleDraftTag(tag.id)}
              >#{tag.name}</button>
            {/each}
          </div>
        {/if}
        <div class="tag-new">
          <input
            type="text"
            placeholder="new tag…"
            autocomplete="off"
            bind:value={newTagInput}
            onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createTag(); } }}
          />
          <button type="button" class="btn-ghost" onclick={createTag}>Add</button>
        </div>
      </div>

      <!-- 05 Visibility -->
      <div class="field">
        <span class="field__label"><span class="index">05</span> Visibility</span>
        <div class="privacy">
          {#each [
            { value: 'public', mark: '○', name: 'Public', hint: 'On the record — anyone may see it.' },
            { value: 'followers', mark: '◐', name: 'Circle', hint: 'Followers only, when the circle arrives.' },
            { value: 'private', mark: '●', name: 'Private', hint: 'For your eyes alone.' },
          ] as opt}
            <label>
              <input
                type="radio"
                name="privacy"
                value={opt.value}
                checked={privacy === opt.value}
                onchange={() => { privacy = opt.value as Privacy; }}
              />
              <span class="mark">{opt.mark}</span>
              <span class="privacy__name">{opt.name}</span>
              <span class="privacy__hint">{opt.hint}</span>
            </label>
          {/each}
        </div>
      </div>

    </div>

    <footer class="sheet__foot">
      <button type="submit" class="btn-primary" disabled={saving}>{submitLabel}</button>
    </footer>
  </form>
</dialog>
