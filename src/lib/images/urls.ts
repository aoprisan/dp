// Object URLs for photo blobs, memoized per photo. Keyed on blob size too so
// replacing a blob (bg removal) busts the entry. Bounded by wardrobe size —
// not revoked within a session.
const cache = new Map<string, string>();

export function blobUrl(id: string, blob: Blob): string {
  const key = `${id}:${blob.size}`;
  let url = cache.get(key);
  if (!url) {
    url = URL.createObjectURL(blob);
    cache.set(key, url);
  }
  return url;
}
