<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    open = $bindable(false),
    title = '',
    children,
  }: { open?: boolean; title?: string; children?: Snippet } = $props();
</script>

<svelte:window
  onkeydown={(e) => {
    if (open && e.key === 'Escape') open = false;
  }}
/>

{#if open}
  <div class="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
    <button
      class="anim-fade absolute inset-0 bg-black/40"
      aria-label="Close"
      onclick={() => (open = false)}
    ></button>
    <div
      class="anim-sheet relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-sheet bg-ground px-4 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
    >
      {#if title}<h2 class="caps-header mb-4">{title}</h2>{/if}
      {@render children?.()}
    </div>
  </div>
{/if}
