/**
 * A tiny key-value wrapper over IndexedDB, for values `localStorage` cannot
 * hold: it stores only strings, while IndexedDB can keep a folder handle or a
 * binary blob as they are. One database, one object store, three functions --
 * anything needing real queries should get its own store, not grow this.
 *
 * Every function rejects if IndexedDB is unavailable (private windows, blocked
 * site data); callers treat that as "nothing saved" and carry on.
 */
const DB_NAME = "boardkit";
const STORE = "kv";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export function idbGet<T>(key: string): Promise<T | undefined> {
  return run("readonly", (store) => store.get(key) as IDBRequest<T | undefined>);
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  await run("readwrite", (store) => store.put(value, key));
}

export async function idbDelete(key: string): Promise<void> {
  await run("readwrite", (store) => store.delete(key));
}

/** Every key that starts with `prefix`, for callers that keep a family of
    records under one prefix (see `imageStore.ts`). */
export function idbKeys(prefix: string): Promise<string[]> {
  return run(
    "readonly",
    (store) => store.getAllKeys(IDBKeyRange.bound(prefix, `${prefix}￿`)) as IDBRequest<string[]>,
  );
}
