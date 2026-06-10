<script lang="ts">
  import type { Snippet } from 'svelte';
  let { title, children }: { title: string; children?: Snippet } = $props();
</script>

<header class="flex min-h-12 items-center justify-between px-4 pt-5 pb-2">
  <h1 class="caps-header">{title}</h1>
  {#if children}
    <div class="flex items-center gap-2">{@render children()}</div>
  {/if}
</header>
