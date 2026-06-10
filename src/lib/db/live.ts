import { liveQuery } from 'dexie';
import { readable, type Readable } from 'svelte/store';

/**
 * Wrap a Dexie liveQuery in a Svelte store. Recreate via $derived when the
 * querier depends on component state — the auto-subscription follows along.
 */
export function live<T>(querier: () => T | Promise<T>, initial: T): Readable<T> {
  return readable(initial, (set) => {
    const sub = liveQuery(querier).subscribe({
      next: (v) => set(v as T),
      error: (e) => console.error('liveQuery', e),
    });
    return () => sub.unsubscribe();
  });
}
