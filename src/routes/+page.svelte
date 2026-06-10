<script lang="ts">
  import { onMount } from 'svelte';
  import { wardrobe } from '$lib/wardrobe.svelte.js';
  import Masthead from '$lib/components/Masthead.svelte';
  import PieceCard from '$lib/components/PieceCard.svelte';
  import EditorSheet from '$lib/components/EditorSheet.svelte';
  import DetailSheet from '$lib/components/DetailSheet.svelte';
  import { fmtCount } from '$lib/utils';
  import type { Item } from '$lib/types';

  let editorOpen = $state(false);
  let detailItem = $state<Item | undefined>(undefined);

  onMount(() => {
    wardrobe.init();
  });

  function openAdd() {
    wardrobe.openEditor();
    editorOpen = true;
  }

  function openEdit(item: Item) {
    wardrobe.openEditor(item);
    editorOpen = true;
  }

  function tagName(id: string): string | undefined {
    return wardrobe.tags.find((t) => t.id === id)?.name;
  }

  const isFiltered = $derived(wardrobe.scope !== 'all' || wardrobe.selectedTags.size > 0);
</script>

<svelte:head>
  <title>Dress Panic — The Archive</title>
</svelte:head>

<main class="app">
  <Masthead />

  <section aria-label="The Archive">
    <div class="section-head">
      <h2>The Archive</h2>
      <span class="count mono">
        <strong>{fmtCount(wardrobe.visible.length)}</strong>
        {wardrobe.visible.length === 1 ? 'piece' : 'pieces'}
      </span>
    </div>

    <div class="scopes" role="group" aria-label="Filter by privacy">
      {#each [
        { value: 'all', label: 'All' },
        { value: 'public', label: 'Public' },
        { value: 'followers', label: 'Circle' },
        { value: 'private', label: 'Private' },
      ] as s}
        <button
          class="scope"
          aria-pressed={wardrobe.scope === s.value}
          onclick={() => wardrobe.setScope(s.value as typeof wardrobe.scope)}
        >{s.label}</button>
      {/each}
    </div>

    {#if wardrobe.tags.length > 0}
      <div class="tag-rail" role="group" aria-label="Filter by tag">
        {#each wardrobe.tags as tag}
          <button
            class="chip"
            aria-pressed={wardrobe.selectedTags.has(tag.id)}
            onclick={() => wardrobe.toggleTag(tag.id)}
          >#{tag.name}</button>
        {/each}
      </div>
    {/if}

    {#if wardrobe.visible.length > 0}
      <div class="grid">
        {#each wardrobe.visible as item, i}
          <PieceCard {item} index={i} {tagName} onclick={() => { detailItem = item; }} />
        {/each}
      </div>
    {:else}
      <div class="empty">
        <span class="fleuron">✼</span>
        <h3>{isFiltered ? 'Nothing under this filter.' : 'Nothing filed yet.'}</h3>
        <p>
          {isFiltered
            ? 'The archive holds no piece matching this selection.'
            : 'Every archive begins with a single piece. Add the thing you wore today.'}
        </p>
      </div>
    {/if}
  </section>

  <button class="btn-add" onclick={openAdd}>
    <span class="plus">+</span> Add a piece
  </button>
</main>

<EditorSheet bind:open={editorOpen} onclose={() => {}} />
<DetailSheet
  bind:item={detailItem}
  onclose={() => { detailItem = undefined; }}
  onedit={openEdit}
/>
