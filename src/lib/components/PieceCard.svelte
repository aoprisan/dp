<script lang="ts">
  import type { Item } from '$lib/types';
  import { photoURL } from '$lib/wardrobe.svelte.js';
  import { PRIVACY_MARK, fmtNo } from '$lib/utils';

  interface Props {
    item: Item;
    index: number;
    onclick: () => void;
    tagName: (id: string) => string | undefined;
  }

  let { item, index, onclick, tagName }: Props = $props();
</script>

<button
  class="piece"
  class:piece--lead={index === 0}
  style="--i: {Math.min(index, 12)}"
  aria-label={item.title}
  {onclick}
>
  <div class="piece__photo">
    {#if item.photos.length > 0}
      <img src={photoURL(item.photos[0])} alt="" loading="lazy" />
    {:else}
      <span class="no-photo">no photograph</span>
    {/if}
  </div>

  <div class="piece__meta mono">
    <span class="no">{fmtNo(item.no)}</span>
    <span>{PRIVACY_MARK[item.privacy]}</span>
  </div>

  <div class="piece__title">{item.title}</div>

  <div class="piece__tags">
    {item.tags.map((t) => tagName(t)).filter(Boolean).map((n) => '#' + n).join('  ')}
  </div>
</button>
