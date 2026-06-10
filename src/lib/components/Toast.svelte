<script lang="ts">
  import { toast } from '$lib/toast.svelte.js';
</script>

<div class="toast mono" class:show={toast.visible} role="status">
  {@html toast.message}
</div>
