<script lang="ts">
  import type { Scale } from '$lib/db/schema';

  let {
    label,
    value = $bindable(3 as Scale),
    captions,
  }: { label: string; value?: Scale; captions?: [string, string] } = $props();
</script>

<div>
  <div class="mb-1.5 flex items-baseline justify-between">
    <span class="text-[13px] text-ink2">{label}</span>
    <span class="data">{value}/5</span>
  </div>
  <div class="flex gap-2">
    {#each [1, 2, 3, 4, 5] as const as n (n)}
      <button
        type="button"
        class="press h-9 flex-1 rounded-tile {n <= value ? 'bg-ink' : 'bg-tile'}"
        aria-label="{label} {n} of 5"
        aria-pressed={value === n}
        onclick={() => (value = n)}
      ></button>
    {/each}
  </div>
  {#if captions}
    <div class="mt-1 flex justify-between">
      <span class="data text-ink3">{captions[0]}</span>
      <span class="data text-ink3">{captions[1]}</span>
    </div>
  {/if}
</div>
