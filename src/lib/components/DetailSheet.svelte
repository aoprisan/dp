<script lang="ts">
  import type { Item } from '$lib/types';
  import { wardrobe, photoURL } from '$lib/wardrobe.svelte.js';
  import { toast } from '$lib/toast.svelte.js';
  import { PRIVACY_MARK, PRIVACY_NAME, fmtNo, fmtDate } from '$lib/utils';

  interface Props {
    item: Item | undefined;
    onclose: () => void;
    onedit: (item: Item) => void;
  }

  let { item = $bindable(), onclose, onedit }: Props = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let removeArmed = $state(false);

  $effect(() => {
    if (!dialog) return;
    if (item) {
      removeArmed = false;
      dialog.showModal();
    } else {
      dialog.close();
    }
  });

  function handleClose() {
    item = undefined;
    onclose();
  }

  async function handleRemove() {
    if (!item) return;
    if (!removeArmed) {
      removeArmed = true;
      return;
    }
    const label = fmtNo(item.no);
    await wardrobe.deleteItem(item.id);
    item = undefined;
    onclose();
    toast.show(`${label} withdrawn from the archive`);
  }

  function handleEdit() {
    if (!item) return;
    const current = item;
    item = undefined;
    onedit(current);
  }

  function tagName(id: string): string | undefined {
    return wardrobe.tags.find((t) => t.id === id)?.name;
  }
</script>

<dialog
  class="sheet"
  bind:this={dialog}
  onclose={handleClose}
>
  {#if item}
    <div class="sheet__frame">
      <header class="sheet__head">
        <div>
          <span class="kicker mono">From the archive</span>
          <h2>The Piece</h2>
        </div>
        <button type="button" class="btn-close" aria-label="Close" onclick={handleClose}>✕</button>
      </header>

      <div class="sheet__body">
        {#if item.photos.length > 0}
          <div class="carousel">
            {#each item.photos as photo}
              <figure>
                <img src={photoURL(photo)} alt={item.title} />
              </figure>
            {/each}
          </div>
        {/if}

        <div class="detail__meta mono">
          <span class="no">{fmtNo(item.no)}</span>
          <span>{PRIVACY_MARK[item.privacy]} {PRIVACY_NAME[item.privacy]}</span>
          <span>Filed {fmtDate(item.createdAt)}</span>
        </div>

        <h3 class="detail__title">{item.title}</h3>

        {#if item.description}
          <p class="detail__desc">{item.description}</p>
        {/if}

        {#if item.tags.length > 0}
          <div class="detail__tags">
            {#each item.tags as tagId}
              {@const name = tagName(tagId)}
              {#if name}
                <span class="chip">#{name}</span>
              {/if}
            {/each}
          </div>
        {/if}

        <div class="detail__actions">
          <button class="btn-ghost" onclick={handleEdit}>Revise</button>
          <button
            class="btn-ghost danger"
            onclick={handleRemove}
          >
            {removeArmed ? 'Remove — certain?' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</dialog>
