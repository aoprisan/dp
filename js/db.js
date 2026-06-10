// IndexedDB layer — local-first storage for the archive.
// Stores: items (pieces, photos inline as Blobs), tags, meta (counters).

const DB_NAME = "dresspanic";
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("items")) {
        const items = db.createObjectStore("items", { keyPath: "id" });
        items.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains("tags")) {
        db.createObjectStore("tags", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        const result = fn(store);
        t.oncomplete = () => resolve(result?.result ?? result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export const db = {
  getAllItems: () => tx("items", "readonly", (s) => s.getAll()),
  putItem: (item) => tx("items", "readwrite", (s) => s.put(item)),
  deleteItem: (id) => tx("items", "readwrite", (s) => s.delete(id)),

  getAllTags: () => tx("tags", "readonly", (s) => s.getAll()),
  putTag: (tag) => tx("tags", "readwrite", (s) => s.put(tag)),
  deleteTag: (id) => tx("tags", "readwrite", (s) => s.delete(id)),

  // Monotonic piece number — survives deletions, like an accession register.
  async nextPieceNumber() {
    const db_ = await openDB();
    return new Promise((resolve, reject) => {
      const t = db_.transaction("meta", "readwrite");
      const store = t.objectStore("meta");
      const get = store.get("pieceCounter");
      get.onsuccess = () => {
        const next = (get.result?.value ?? 0) + 1;
        store.put({ key: "pieceCounter", value: next });
        resolve(next);
      };
      get.onerror = () => reject(get.error);
    });
  },
};

export function uid() {
  return crypto.randomUUID();
}
