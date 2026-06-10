import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { db, type Photo } from '$lib/db/schema';
import { recomputeAccent } from '$lib/stores/accent';

const FORMAT = 1;

interface BackupData {
  format: number;
  exportedAt: string;
  items: unknown[];
  photos: (Omit<Photo, 'blob' | 'thumb'> & { blobType: string; thumbType: string })[];
  tags: unknown[];
  looks: unknown[];
  calendar: unknown[];
  wears: unknown[];
  trips: unknown[];
  settings: unknown[];
}

/** Lossless zip: data.json + photos/<id> + thumbs/<id> (§P8). */
export async function exportBackup(): Promise<Blob> {
  const [items, photos, tags, looks, calendar, wears, trips, settings] = await Promise.all([
    db.items.toArray(),
    db.photos.toArray(),
    db.tags.toArray(),
    db.looks.toArray(),
    db.calendar.toArray(),
    db.wears.toArray(),
    db.trips.toArray(),
    db.settings.toArray(),
  ]);
  const data: BackupData = {
    format: FORMAT,
    exportedAt: new Date().toISOString(),
    items,
    photos: photos.map(({ blob, thumb, ...meta }) => ({
      ...meta,
      blobType: blob.type,
      thumbType: thumb.type,
    })),
    tags,
    looks,
    calendar,
    wears,
    trips,
    settings,
  };
  const files: Record<string, Uint8Array> = {
    'data.json': strToU8(JSON.stringify(data)),
  };
  for (const p of photos) {
    files[`photos/${p.id}`] = new Uint8Array(await p.blob.arrayBuffer());
    files[`thumbs/${p.id}`] = new Uint8Array(await p.thumb.arrayBuffer());
  }
  const zipped = zipSync(files, { level: 0 }); // photos are already compressed
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}

export async function saveBackup() {
  const blob = await exportBackup();
  const name = `dresspanic-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  const picker = (
    window as unknown as {
      showSaveFilePicker?: (o: object) => Promise<{ createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }> }>;
    }
  ).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: name,
        types: [{ description: 'Zip archive', accept: { 'application/zip': ['.zip'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
      // fall through to anchor download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Wipe and restore everything from a backup zip. */
export async function importBackup(file: Blob) {
  const unzipped = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const dataRaw = unzipped['data.json'];
  if (!dataRaw) throw new Error('Not a Dress Panic backup (data.json missing)');
  const data = JSON.parse(strFromU8(dataRaw)) as BackupData;
  if (data.format !== FORMAT) throw new Error(`Unsupported backup format ${data.format}`);

  const photos: Photo[] = data.photos.map((meta) => {
    const blobBytes = unzipped[`photos/${meta.id}`];
    const thumbBytes = unzipped[`thumbs/${meta.id}`];
    if (!blobBytes || !thumbBytes) throw new Error(`Backup missing photo ${meta.id}`);
    const { blobType, thumbType, ...rest } = meta;
    return {
      ...rest,
      blob: new Blob([blobBytes.slice().buffer as ArrayBuffer], { type: blobType }),
      thumb: new Blob([thumbBytes.slice().buffer as ArrayBuffer], { type: thumbType }),
    };
  });

  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.items.bulkAdd(data.items as never[]);
    await db.photos.bulkAdd(photos);
    await db.tags.bulkAdd(data.tags as never[]);
    await db.looks.bulkAdd(data.looks as never[]);
    await db.calendar.bulkAdd(data.calendar as never[]);
    await db.wears.bulkAdd(data.wears as never[]);
    await db.trips.bulkAdd(data.trips as never[]);
    await db.settings.bulkAdd(data.settings as never[]);
  });
  void recomputeAccent();
}
