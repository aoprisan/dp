import type { Item, Tag } from './types';

const DB_NAME = 'dresspanic';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains('items')) {
        const items = database.createObjectStore('items', { keyPath: 'id' });
        items.createIndex('createdAt', 'createdAt');
      }
      if (!database.objectStoreNames.contains('tags')) {
        database.createObjectStore('tags', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('meta')) {
        database.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    (database) =>
      new Promise((resolve, reject) => {
        const t = database.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        const req = fn(store);
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export const db = {
  getAllItems: () => tx<Item[]>('items', 'readonly', (s) => s.getAll()),
  putItem: (item: Item) => tx<IDBValidKey>('items', 'readwrite', (s) => s.put(item)),
  deleteItem: (id: string) => tx<undefined>('items', 'readwrite', (s) => s.delete(id)),

  getAllTags: () => tx<Tag[]>('tags', 'readonly', (s) => s.getAll()),
  putTag: (tag: Tag) => tx<IDBValidKey>('tags', 'readwrite', (s) => s.put(tag)),
  deleteTag: (id: string) => tx<undefined>('tags', 'readwrite', (s) => s.delete(id)),

  async nextPieceNumber(): Promise<number> {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const t = database.transaction('meta', 'readwrite');
      const store = t.objectStore('meta');
      const get = store.get('pieceCounter');
      get.onsuccess = () => {
        const next = ((get.result as { key: string; value: number } | undefined)?.value ?? 0) + 1;
        store.put({ key: 'pieceCounter', value: next });
        resolve(next);
      };
      get.onerror = () => reject(get.error);
    });
  },
};

export const uid = (): string => crypto.randomUUID();
