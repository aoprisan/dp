<script lang="ts">
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { toast } from '$lib/toast.svelte.js';

  const tabs = [
    { routeId: '/', label: 'Archive', glyph: 'A', href: `${base}/`, soon: false },
    { routeId: '/looks', label: 'Looks', glyph: 'L', href: `${base}/looks`, soon: true },
    { routeId: '/feed', label: 'Feed', glyph: 'F', href: `${base}/feed`, soon: true },
    { routeId: '/you', label: 'You', glyph: 'Y', href: `${base}/you`, soon: true },
  ];

  function handleSoon(e: MouseEvent) {
    e.preventDefault();
    toast.show('In the next issue.');
  }
</script>

<nav class="tabbar" aria-label="Main">
  <div class="tabbar__inner">
    {#each tabs as tab}
      <a
        href={tab.href}
        class="tab"
        aria-current={page.route.id === tab.routeId ? 'page' : undefined}
        onclick={tab.soon ? handleSoon : undefined}
      >
        <span class="glyph">{tab.glyph}</span>
        {tab.label}
        {#if tab.soon}<span class="soon">soon</span>{/if}
      </a>
    {/each}
  </div>
</nav>
