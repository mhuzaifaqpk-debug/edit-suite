import type { MediaAsset, Project } from "./types";

const DB_NAME = "reelforge";
const DB_VERSION = 1;
const STORE_PROJECT = "projects";
const STORE_MEDIA_META = "media";
const STORE_MEDIA_BLOB = "blobs";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_PROJECT))
          db.createObjectStore(STORE_PROJECT, { keyPath: "id" });
        if (!db.objectStoreNames.contains(STORE_MEDIA_META))
          db.createObjectStore(STORE_MEDIA_META, { keyPath: "id" });
        if (!db.objectStoreNames.contains(STORE_MEDIA_BLOB)) db.createObjectStore(STORE_MEDIA_BLOB);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const projectStore = {
  save: (project: Project) => tx(STORE_PROJECT, "readwrite", (s) => s.put(project)),
  load: (id: string) => tx<Project | undefined>(STORE_PROJECT, "readonly", (s) => s.get(id)),
  all: () => tx<Project[]>(STORE_PROJECT, "readonly", (s) => s.getAll()),
};

export const mediaStore = {
  putMeta: (asset: MediaAsset) => tx(STORE_MEDIA_META, "readwrite", (s) => s.put(asset)),
  allMeta: () => tx<MediaAsset[]>(STORE_MEDIA_META, "readonly", (s) => s.getAll()),
  putBlob: (id: string, blob: Blob) => tx(STORE_MEDIA_BLOB, "readwrite", (s) => s.put(blob, id)),
  getBlob: (id: string) => tx<Blob | undefined>(STORE_MEDIA_BLOB, "readonly", (s) => s.get(id)),
  deleteMeta: (id: string) => tx(STORE_MEDIA_META, "readwrite", (s) => s.delete(id)),
  deleteBlob: (id: string) => tx(STORE_MEDIA_BLOB, "readwrite", (s) => s.delete(id)),
};

export const LAST_PROJECT_KEY = "reelforge.lastProjectId";
