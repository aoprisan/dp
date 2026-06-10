<script lang="ts">
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import IconHanger from '@tabler/icons-svelte/icons/hanger';
  import IconStack2 from '@tabler/icons-svelte/icons/stack-2';
  import IconCalendar from '@tabler/icons-svelte/icons/calendar';
  import IconSparkles from '@tabler/icons-svelte/icons/sparkles';
  import IconDots from '@tabler/icons-svelte/icons/dots';

  const tabs = [
    { href: '/closet', label: 'Closet', icon: IconHanger },
    { href: '/looks', label: 'Looks', icon: IconStack2 },
    { href: '/calendar', label: 'Calendar', icon: IconCalendar },
    { href: '/assistant', label: 'Assistant', icon: IconSparkles },
    { href: '/more', label: 'More', icon: IconDots },
  ];
  const MORE = ['/more', '/stats', '/trips', '/settings'];

  const path = $derived(page.url.pathname.slice(base.length) || '/');
  function isActive(href: string): boolean {
    if (href === '/more') return MORE.some((m) => path.startsWith(m));
    return path.startsWith(href);
  }
</script>

<nav
  class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ground"
  style="padding-bottom: env(safe-area-inset-bottom)"
>
  <div class="mx-auto flex max-w-md">
    {#each tabs as tab (tab.href)}
      <a
        href="{base}{tab.href}"
        class="press flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 {isActive(tab.href)
          ? 'text-ink'
          : 'text-ink3'}"
        aria-current={isActive(tab.href) ? 'page' : undefined}
      >
        <tab.icon size={22} stroke={1.75} />
        <span class="text-[10px] font-medium">{tab.label}</span>
      </a>
    {/each}
  </div>
</nav>
