<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import TabBar from '$lib/components/TabBar.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { live } from '$lib/db/live';
  import { db } from '$lib/db/schema';
  import { applyAccent, FALLBACK_ACCENT } from '$lib/stores/accent';
  import { applyTheme, resolveDark, type Theme } from '$lib/stores/settings';

  let { children }: { children: Snippet } = $props();

  const settings = live(() => db.settings.toArray(), []);
  const theme = $derived(($settings.find((s) => s.key === 'theme')?.value as Theme) ?? 'system');
  const accent = $derived(($settings.find((s) => s.key === 'accent')?.value as string) ?? FALLBACK_ACCENT);

  $effect(() => {
    applyTheme(theme);
    applyAccent(accent, resolveDark(theme));
  });

  $effect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const refresh = () => {
      applyTheme(theme);
      applyAccent(accent, resolveDark(theme));
    };
    mq.addEventListener('change', refresh);
    return () => mq.removeEventListener('change', refresh);
  });
</script>

<div class="mx-auto min-h-dvh w-full max-w-md pb-28">
  {@render children()}
</div>
<TabBar />
<Toast />
