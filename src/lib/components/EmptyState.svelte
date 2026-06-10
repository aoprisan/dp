<script lang="ts">
  import type { Snippet } from 'svelte';
  // §2 rule 9: one sentence + one accent action. `brand` adds the single
  // Fraunces moment, used on the closet empty state only.
  let {
    sentence,
    brand = false,
    children,
  }: { sentence: string; brand?: boolean; children?: Snippet } = $props();
</script>

<div class="anim-fade flex flex-col items-center gap-5 px-8 pt-24 pb-16 text-center">
  {#if brand}
    <p class="font-display text-[34px] leading-tight text-ink">Dress&nbsp;Panic</p>
  {/if}
  <p class="text-[15px] text-ink2">{sentence}</p>
  {#if children}{@render children()}{/if}
</div>
