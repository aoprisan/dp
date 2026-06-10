<script lang="ts">
  import '../app.css';
  import TabBar from '$lib/components/TabBar.svelte';
  import Toast from '$lib/components/Toast.svelte';

  let { children } = $props();
</script>

{@render children()}
<TabBar />
<Toast />
