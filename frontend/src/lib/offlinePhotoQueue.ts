/**
 * offlinePhotoQueue.ts
 * Browser-native IndexedDB queue for caching photos taken on site when cellular signal drops.
 * Zero external dependencies, compatible with all mobile browsers (iOS Safari, Android Chrome).
 */

export interface OfflinePhotoRecord {
  id: string;
  inspectionId: string;
  fileName: string;
  tag: string;
  mimeType: string;
  blob: Blob;
  createdAt: string;
  synced: boolean;
}

const DB_NAME = "NexusFieldInspectorDB";
const DB_VERSION = 1;
const STORE_NAME = "offline_photos";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported on this device."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("inspectionId", "inspectionId", { unique: false });
        store.createIndex("synced", "synced", { unique: false });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

/**
 * Saves a compressed photo file to the local IndexedDB queue
 */
export async function saveOfflinePhoto(
  inspectionId: string,
  file: File | Blob,
  fileName: string,
  tag: string
): Promise<OfflinePhotoRecord> {
  const db = await openDB();
  const id = `off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const record: OfflinePhotoRecord = {
    id,
    inspectionId,
    fileName,
    tag,
    mimeType: file.type || "image/jpeg",
    blob: file,
    createdAt: new Date().toISOString(),
    synced: false,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(record);

    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves all offline photos queued for a specific inspection
 */
export async function getOfflinePhotosForInspection(
  inspectionId: string
): Promise<OfflinePhotoRecord[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("inspectionId");
      const req = index.getAll(IDBKeyRange.only(inspectionId));

      req.onsuccess = () => {
        resolve(req.result || []);
      };
      req.onerror = () => {
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

/**
 * Counts all pending unsynced photos across all inspections
 */
export async function countPendingOfflinePhotos(): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const list: OfflinePhotoRecord[] = req.result || [];
        resolve(list.filter((p) => !p.synced).length);
      };
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

/**
 * Removes an offline photo from IndexedDB after successful upload
 */
export async function deleteOfflinePhoto(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}

/**
 * Auto-syncs all pending offline photos for an inspection when internet is available
 */
export async function syncOfflinePhotos(
  inspectionId: string,
  uploadHandler: (record: OfflinePhotoRecord) => Promise<any>
): Promise<{ syncedCount: number; errors: string[] }> {
  const photos = await getOfflinePhotosForInspection(inspectionId);
  const pending = photos.filter((p) => !p.synced);

  let syncedCount = 0;
  const errors: string[] = [];

  for (const photo of pending) {
    try {
      await uploadHandler(photo);
      await deleteOfflinePhoto(photo.id);
      syncedCount++;
    } catch (err: any) {
      errors.push(`Photo "${photo.fileName}": ${err.message || "Upload failed"}`);
    }
  }

  return { syncedCount, errors };
}
