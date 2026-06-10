<script lang="ts">
  import { seedDatabase } from '$lib/seed';

  let status = $state<'idle' | 'running' | 'done' | 'error'>('idle');
  let logs = $state<string[]>([]);
  let summary = $state('');

  async function run() {
    status = 'running';
    logs = [];
    try {
      const result = await seedDatabase((msg) => {
        logs = [...logs, msg];
      });
      summary = `✓ ${result.itemCount} items · ${result.wearCount} wears · ${result.lookCount} looks`;
      status = 'done';
    } catch (err) {
      logs = [...logs, `Error: ${err}`];
      status = 'error';
    }
  }
</script>

<div class="seed-page">
  <h1>Seed Database</h1>
  <p class="warning">Dev only — clears all existing data and replaces it with mock wardrobe.</p>

  {#if status === 'idle' || status === 'error'}
    <button onclick={run} class="btn">
      {status === 'error' ? 'Retry' : 'Seed Now'}
    </button>
  {:else if status === 'running'}
    <p class="running">Seeding… (fetching {21} photos from loremflickr)</p>
  {:else if status === 'done'}
    <p class="done">{summary}</p>
    <a href="/closet" class="btn">Open Closet →</a>
  {/if}

  {#if logs.length > 0}
    <pre class="log">{logs.join('\n')}</pre>
  {/if}
</div>

<style>
  .seed-page {
    max-width: 600px;
    margin: 4rem auto;
    padding: 2rem;
    font-family: monospace;
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .warning {
    color: #b45309;
    margin-bottom: 1.5rem;
    font-size: 0.875rem;
  }

  .btn {
    display: inline-block;
    padding: 0.6rem 1.4rem;
    background: #1a1a1a;
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    text-decoration: none;
    margin-bottom: 1rem;
  }

  .btn:hover {
    opacity: 0.8;
  }

  .running {
    color: #555;
    font-size: 0.875rem;
  }

  .done {
    color: #166534;
    font-weight: bold;
    margin-bottom: 1rem;
  }

  .log {
    margin-top: 1.5rem;
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 1rem;
    font-size: 0.8rem;
    line-height: 1.6;
    max-height: 400px;
    overflow-y: auto;
    white-space: pre-wrap;
  }
</style>
