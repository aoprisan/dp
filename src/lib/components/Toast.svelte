<script lang="ts">
  import { toast } from '$lib/stores/toast.svelte';
</script>

{#if toast.message}
  <div class="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4">
    <div class="anim-sheet rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-ground">
      {toast.message}
    </div>
  </div>
{/if}
