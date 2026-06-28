import { Injectable } from '@angular/core';
import { PuzzleAttempt } from '../models/puzzle.model';

const DB_NAME = 'chess-mentor';
const DB_VERSION = 1;
const STORE = 'attempts';

/**
 * Persistence boundary for solver progress. Wraps IndexedDB behind a small
 * async API so the rest of the app never touches `localStorage`/`indexedDB`
 * directly. Falls back to an in-memory store when IndexedDB is unavailable
 * (unit tests under jsdom, SSR, private-mode quirks).
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly supported =
    typeof indexedDB !== 'undefined' && indexedDB !== null;
  private readonly memory: PuzzleAttempt[] = [];
  private dbPromise: Promise<IDBDatabase> | null = null;

  /** Persist a single attempt. */
  async saveAttempt(attempt: PuzzleAttempt): Promise<void> {
    if (!this.supported) {
      this.memory.push(attempt);
      return;
    }
    const db = await this.openDb();
    await this.tx(db, 'readwrite', (store) => store.add(attempt));
  }

  /** Every recorded attempt, newest first. */
  async allAttempts(): Promise<PuzzleAttempt[]> {
    if (!this.supported) {
      return [...this.memory].sort(byNewest);
    }
    const db = await this.openDb();
    const items = await this.txRead<PuzzleAttempt[]>(db, (store) => store.getAll());
    return items.sort(byNewest);
  }

  /** Drop all stored progress. */
  async clear(): Promise<void> {
    if (!this.supported) {
      this.memory.length = 0;
      return;
    }
    const db = await this.openDb();
    await this.tx(db, 'readwrite', (store) => store.clear());
  }

  private openDb(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'key', autoIncrement: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }

  private tx(
    db: IDBDatabase,
    mode: IDBTransactionMode,
    op: (store: IDBObjectStore) => IDBRequest,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      op(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  private txRead<T>(db: IDBDatabase, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readonly');
      const request = op(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

function byNewest(a: PuzzleAttempt, b: PuzzleAttempt): number {
  return new Date(b.solvedAt).getTime() - new Date(a.solvedAt).getTime();
}
