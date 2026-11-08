/**
 * Test-local IndexedDB storage-engine fault — scripts/** only.
 * Must never be imported from lib/ or app/ production modules.
 *
 * Arms a one-shot fault on a named object store: the next write request
 * (put / add / cursor.update) on that store is issued normally, then the
 * owning IDBTransaction is aborted by the storage layer. This mirrors how a
 * real quota / disk failure surfaces (request error + transaction abort) and
 * rolls back every write in that transaction. Production code is untouched:
 * casWritePOJUSession → Dexie transaction → IndexedDB all run for real.
 *
 * Requires a global IndexedDB implementation (fake-indexeddb/auto) installed
 * before the first Dexie open.
 */

export type IdbWriteFault = {
  /** Store whose next write aborts its transaction. */
  readonly storeName: string;
  /** Number of write requests that triggered an abort. */
  readonly hits: () => number;
  /** Restore the original IndexedDB prototype methods. Idempotent. */
  readonly restore: () => void;
};

function storeNameOfCursor(cursor: IDBCursor): string | null {
  const src = cursor.source;
  if (src && typeof src === "object" && "name" in src) {
    const owner = "objectStore" in src ? src.objectStore : src;
    return typeof owner.name === "string" ? owner.name : null;
  }
  return null;
}

/**
 * Patch IndexedDB write requests on `storeName`: each of the next `shots`
 * writes is issued normally, then `onWrite` runs with its transaction.
 */
function interceptStoreWrites(
  caller: string,
  storeName: string,
  onWrite: (tx: IDBTransaction) => void,
  shots: number,
): IdbWriteFault {
  const storeProto = globalThis.IDBObjectStore?.prototype;
  const cursorProto = globalThis.IDBCursor?.prototype;
  if (!storeProto || !cursorProto) {
    throw new Error(`${caller}: global IndexedDB (fake-indexeddb/auto) not installed`);
  }

  const originalPut = storeProto.put;
  const originalAdd = storeProto.add;
  const originalCursorUpdate = cursorProto.update;
  let remaining = shots;
  let hitCount = 0;
  let restored = false;

  const fire = <R>(tx: IDBTransaction, req: R): R => {
    remaining -= 1;
    hitCount += 1;
    onWrite(tx);
    return req;
  };

  storeProto.put = function interceptedPut(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    const req = originalPut.call(this, value, key);
    if (remaining > 0 && this.name === storeName) return fire(this.transaction, req);
    return req;
  };
  storeProto.add = function interceptedAdd(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    const req = originalAdd.call(this, value, key);
    if (remaining > 0 && this.name === storeName) return fire(this.transaction, req);
    return req;
  };
  cursorProto.update = function interceptedCursorUpdate(this: IDBCursor, value: unknown) {
    const req = originalCursorUpdate.call(this, value);
    if (remaining > 0 && storeNameOfCursor(this) === storeName) {
      if (!req.transaction) throw new Error(`${caller}: cursor update request has no transaction`);
      return fire(req.transaction, req);
    }
    return req;
  };

  return {
    storeName,
    hits: () => hitCount,
    restore: () => {
      if (restored) return;
      restored = true;
      storeProto.put = originalPut;
      storeProto.add = originalAdd;
      cursorProto.update = originalCursorUpdate;
    },
  };
}

/**
 * Arm a fault for `storeName`. `shots` = how many write requests abort their
 * transaction before the fault disarms itself (default 1).
 */
export function armIdbWriteFault(storeName: string, shots = 1): IdbWriteFault {
  return interceptStoreWrites("armIdbWriteFault", storeName, (tx) => tx.abort(), shots);
}

/**
 * Observe (not fail) the next write on `storeName`: `onWrite` runs right after
 * the request is issued; the transaction then commits normally. Used to
 * sequence a second test fault strictly after a durable write.
 */
export function armIdbWriteHook(storeName: string, onWrite: () => void): IdbWriteFault {
  return interceptStoreWrites("armIdbWriteHook", storeName, () => onWrite(), 1);
}

/** Run `fn` with a one-shot fault armed on `storeName`; always restores. */
export async function withIdbWriteFault<T>(
  storeName: string,
  fn: (fault: IdbWriteFault) => Promise<T>,
  shots = 1,
): Promise<{ value: T; hits: number }> {
  const fault = armIdbWriteFault(storeName, shots);
  try {
    const value = await fn(fault);
    return { value, hits: fault.hits() };
  } finally {
    fault.restore();
  }
}
