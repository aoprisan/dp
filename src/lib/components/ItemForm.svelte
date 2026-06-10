<script module lang="ts">
  import { CATEGORIES, type Category, type Item, type Scale } from '$lib/db/schema';

  export interface ItemFormDraft {
    title: string;
    category: Category;
    brand: string;
    priceStr: string; // euros, free text
    warmth: Scale;
    formality: Scale;
    notes: string;
    tagIds: string[];
  }

  export function emptyDraft(): ItemFormDraft {
    return { title: '', category: 'top', brand: '', priceStr: '', warmth: 3, formality: 3, notes: '', tagIds: [] };
  }

  export function draftFromItem(item: Item): ItemFormDraft {
    return {
      title: item.title,
      category: item.category,
      brand: item.brand ?? '',
      priceStr: item.price != null ? String(item.price / 100) : '',
      warmth: item.warmth,
      formality: item.formality,
      notes: item.notes ?? '',
      tagIds: [...item.tagIds],
    };
  }

  /** Fields ready for db.items — undefined for blanks. */
  export function draftFields(d: ItemFormDraft) {
    const price = parseFloat(d.priceStr.replace(',', '.'));
    return {
      title: d.title.trim() || 'Untitled piece',
      category: d.category,
      brand: d.brand.trim() || undefined,
      price: Number.isFinite(price) && price >= 0 ? Math.round(price * 100) : undefined,
      warmth: d.warmth,
      formality: d.formality,
      notes: d.notes.trim() || undefined,
      tagIds: d.tagIds,
    };
  }
</script>

<script lang="ts">
  import { db } from '$lib/db/schema';
  import { ensureTag } from '$lib/db/repo';
  import { live } from '$lib/db/live';
  import ScaleDots from './ScaleDots.svelte';
  import IconPlus from '@tabler/icons-svelte/icons/plus';

  let { draft = $bindable() }: { draft: ItemFormDraft } = $props();

  const tags = live(() => db.tags.toArray(), []);
  let newTag = $state('');

  function toggleTag(id: string) {
    draft.tagIds = draft.tagIds.includes(id) ? draft.tagIds.filter((t) => t !== id) : [...draft.tagIds, id];
  }

  async function addTag() {
    if (!newTag.trim()) return;
    const id = await ensureTag(newTag);
    if (!draft.tagIds.includes(id)) draft.tagIds = [...draft.tagIds, id];
    newTag = '';
  }
</script>

<div class="flex flex-col gap-5">
  <input class="input-field" placeholder="Title — e.g. Linen shirt" bind:value={draft.title} />

  <div>
    <p class="mb-1.5 text-[13px] text-ink2">Category</p>
    <div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
      {#each CATEGORIES as cat (cat)}
        <button
          type="button"
          class="chip {draft.category === cat ? 'chip-active' : ''}"
          onclick={() => (draft.category = cat)}
        >
          {cat}
        </button>
      {/each}
    </div>
  </div>

  <div class="grid grid-cols-2 gap-3">
    <input class="input-field" placeholder="Brand" bind:value={draft.brand} />
    <input class="input-field" placeholder="Price €" inputmode="decimal" bind:value={draft.priceStr} />
  </div>

  <ScaleDots label="Warmth" bind:value={draft.warmth} captions={['summer', 'deep winter']} />
  <ScaleDots label="Formality" bind:value={draft.formality} captions={['lounging', 'black tie']} />

  <div>
    <p class="mb-1.5 text-[13px] text-ink2">Tags</p>
    <div class="flex flex-wrap gap-2">
      {#each $tags as tag (tag.id)}
        <button
          type="button"
          class="chip {draft.tagIds.includes(tag.id) ? 'chip-active' : ''}"
          onclick={() => toggleTag(tag.id)}
        >
          {tag.name}
        </button>
      {/each}
      <form
        class="flex items-center gap-1"
        onsubmit={(e) => {
          e.preventDefault();
          addTag();
        }}
      >
        <input
          class="w-28 rounded-full bg-tile px-3 py-1.5 text-[13px] outline-none placeholder:text-ink3"
          placeholder="new tag"
          bind:value={newTag}
        />
        {#if newTag.trim()}
          <button type="submit" class="press text-ink2" aria-label="Add tag"><IconPlus size={18} /></button>
        {/if}
      </form>
    </div>
  </div>

  <textarea class="input-field min-h-20 resize-y" placeholder="Notes" bind:value={draft.notes}></textarea>
</div>
