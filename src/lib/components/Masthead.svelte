<script lang="ts">
  import { onMount } from 'svelte';

  let edition = $state('');
  let offline = $state(false);
  let showInstall = $state(false);
  let deferredPrompt: BeforeInstallPromptEvent | null = null;

  function updateEdition() {
    offline = !navigator.onLine;
    edition = offline
      ? 'Offline Edition'
      : new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date());
  }

  onMount(() => {
    updateEdition();
    window.addEventListener('online', updateEdition);
    window.addEventListener('offline', updateEdition);

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstall = true;
    });

    window.addEventListener('appinstalled', () => {
      showInstall = false;
      deferredPrompt = null;
    });

    return () => {
      window.removeEventListener('online', updateEdition);
      window.removeEventListener('offline', updateEdition);
    };
  });

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    deferredPrompt = null;
    showInstall = false;
  }
</script>

<header class="masthead">
  <div class="masthead__issue mono">
    <span>Vol. 1 <span class="dot"></span> No. 2</span>
    <span class="edition-badge" class:offline>{edition}</span>
    {#if showInstall}
      <button class="btn-install" onclick={install}>Install</button>
    {/if}
  </div>
  <h1 class="masthead__title">Dress Panic<span class="period">.</span></h1>
  <hr class="masthead__rule" />
</header>
