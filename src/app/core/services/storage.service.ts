import { Injectable } from '@angular/core';
import { PuzzleAttempt } from '../models/puzzle.model';
import { SavedGame } from '../models/saved-game.model';
import { RepertoireEntry } from '../models/opening.model';
import { RushScore } from '../models/rush.model';
import { DrillProgress } from '../models/drill.model';
import { ChessMentorBackup } from '../models/backup.model';

const DB_NAME = 'chess-mentor';
const DB_VERSION = 3;

/** Object stores; v2 adds everything beyond `attempts`; v3 adds `settings`. */
const STORES: ReadonlyArray<{ readonly name: string; readonly options: IDBObjectStoreParameters }> = [
  { name: 'attempts', options: { keyPath: 'key', autoIncrement: true } },
  { name: 'games', options: { keyPath: 'id' } },
  { name: 'repertoire', options: { keyPath: 'id' } },
  { name: 'rush', options: { keyPath: 'key', autoIncrement: true } },
  { name: 'drills', options: { keyPath: 'id' } },
  { name: 'settings', options: { keyPath: 'key' } },
];

/** Small key/value rows (auth token, preferences…). */
interface SettingRow {
  readonly key: string;
  readonly value: unknown;
}

/**
 * Persistence boundary for all local data (attempts, games, repertoire, rush
 * scores, drill progress). Wraps IndexedDB behind a small async API so the
 * rest of the app never touches `localStorage`/`indexedDB` directly. Falls
 * back to an in-memory store when IndexedDB is unavailable (unit tests under
 * jsdom, SSR, private-mode quirks).
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly supported =
    typeof indexedDB !== 'undefined' && indexedDB !== null;
  private readonly memory = new Map<string, unknown[]>();
  private dbPromise: Promise<IDBDatabase> | null = null;

  // ─── Puzzle attempts ────────────────────────────────────────────────────
  async saveAttempt(attempt: PuzzleAttempt): Promise<void> {
    await this.write('attempts', attempt, 'add');
  }

  /** Every recorded attempt, newest first. */
  async allAttempts(): Promise<PuzzleAttempt[]> {
    const items = await this.readAll<PuzzleAttempt>('attempts');
    return items.sort(
      (a, b) => new Date(b.solvedAt).getTime() - new Date(a.solvedAt).getTime(),
    );
  }

  /** Drop all stored puzzle attempts. */
  async clear(): Promise<void> {
    await this.clearStore('attempts');
  }

  // ─── Instructor games ───────────────────────────────────────────────────
  async saveGame(game: SavedGame): Promise<void> {
    await this.write('games', game, 'put');
  }

  /** Upsert (used to attach a review to an existing game). */
  async updateGame(game: SavedGame): Promise<void> {
    await this.write('games', game, 'put');
  }

  /** Every saved game, newest first. */
  async allGames(): Promise<SavedGame[]> {
    const items = await this.readAll<SavedGame>('games');
    return items.sort(
      (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime(),
    );
  }

  // ─── Opening repertoire ─────────────────────────────────────────────────
  async addRepertoire(entry: RepertoireEntry): Promise<void> {
    await this.write('repertoire', entry, 'put');
  }

  async allRepertoire(): Promise<RepertoireEntry[]> {
    const items = await this.readAll<RepertoireEntry>('repertoire');
    return items.sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
    );
  }

  async removeRepertoire(id: string): Promise<void> {
    await this.deleteById('repertoire', id);
  }

  // ─── Puzzle rush ────────────────────────────────────────────────────────
  async addRushScore(score: RushScore): Promise<void> {
    await this.write('rush', score, 'add');
  }

  async allRushScores(): Promise<RushScore[]> {
    return this.readAll<RushScore>('rush');
  }

  // ─── Endgame drills ─────────────────────────────────────────────────────
  async markDrill(progress: DrillProgress): Promise<void> {
    await this.write('drills', progress, 'put');
  }

  async allDrills(): Promise<DrillProgress[]> {
    return this.readAll<DrillProgress>('drills');
  }

  // ─── Settings (key/value : token OAuth, préférences) ────────────────────
  async setSetting(key: string, value: unknown): Promise<void> {
    await this.write('settings', { key, value } satisfies SettingRow, 'put');
  }

  async getSetting<T>(key: string): Promise<T | null> {
    const rows = await this.readAll<SettingRow>('settings');
    const row = rows.find((r) => r.key === key);
    return row ? (row.value as T) : null;
  }

  async removeSetting(key: string): Promise<void> {
    await this.deleteById('settings', key);
  }

  // ─── Backup (export / import) ───────────────────────────────────────────
  /** Snapshot of every store, ready to be serialized to JSON. */
  async exportAll(): Promise<ChessMentorBackup> {
    const [attempts, games, repertoire, rush, drills] = await Promise.all([
      this.readAll<PuzzleAttempt>('attempts'),
      this.readAll<SavedGame>('games'),
      this.readAll<RepertoireEntry>('repertoire'),
      this.readAll<RushScore>('rush'),
      this.readAll<DrillProgress>('drills'),
    ]);
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      attempts,
      games,
      repertoire,
      rush,
      drills,
    };
  }

  /** REPLACE all local data with the backup's (dates revived from ISO). */
  async importAll(backup: ChessMentorBackup): Promise<void> {
    const asDate = (v: unknown): Date => new Date(v as string);
    await Promise.all(STORES.map(({ name }) => this.clearStore(name)));
    await Promise.all([
      ...backup.attempts.map((a) =>
        this.write('attempts', { ...a, solvedAt: asDate(a.solvedAt) }, 'add'),
      ),
      ...backup.games.map((g) =>
        this.write(
          'games',
          {
            ...g,
            playedAt: asDate(g.playedAt),
            review: g.review ? { ...g.review, analyzedAt: asDate(g.review.analyzedAt) } : g.review,
          },
          'put',
        ),
      ),
      ...backup.repertoire.map((r) =>
        this.write('repertoire', { ...r, addedAt: asDate(r.addedAt) }, 'put'),
      ),
      ...backup.rush.map((s) => this.write('rush', { ...s, at: asDate(s.at) }, 'add')),
      ...backup.drills.map((d) =>
        this.write('drills', { ...d, completedAt: asDate(d.completedAt) }, 'put'),
      ),
    ]);
  }

  // ─── Generic plumbing ───────────────────────────────────────────────────
  private mem(store: string): unknown[] {
    let list = this.memory.get(store);
    if (!list) {
      list = [];
      this.memory.set(store, list);
    }
    return list;
  }

  private async write(store: string, value: unknown, mode: 'add' | 'put'): Promise<void> {
    if (!this.supported) {
      const list = this.mem(store);
      const id = (value as { id?: string; key?: string }).id ?? (value as { key?: string }).key;
      if (mode === 'put' && id !== undefined) {
        const i = list.findIndex(
          (v) => ((v as { id?: string; key?: string }).id ?? (v as { key?: string }).key) === id,
        );
        if (i >= 0) {
          list[i] = value;
          return;
        }
      }
      list.push(value);
      return;
    }
    const db = await this.openDb();
    await this.tx(db, store, 'readwrite', (s) => (mode === 'add' ? s.add(value) : s.put(value)));
  }

  private async readAll<T>(store: string): Promise<T[]> {
    if (!this.supported) {
      return [...(this.mem(store) as T[])];
    }
    const db = await this.openDb();
    return this.txRead<T[]>(db, store, (s) => s.getAll());
  }

  private async deleteById(store: string, id: string): Promise<void> {
    if (!this.supported) {
      const list = this.mem(store);
      const i = list.findIndex((v) => (v as { id?: string }).id === id);
      if (i >= 0) list.splice(i, 1);
      return;
    }
    const db = await this.openDb();
    await this.tx(db, store, 'readwrite', (s) => s.delete(id));
  }

  private async clearStore(store: string): Promise<void> {
    if (!this.supported) {
      this.mem(store).length = 0;
      return;
    }
    const db = await this.openDb();
    await this.tx(db, store, 'readwrite', (s) => s.clear());
  }

  private openDb(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const { name, options } of STORES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, options);
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }

  private tx(
    db: IDBDatabase,
    store: string,
    mode: IDBTransactionMode,
    op: (s: IDBObjectStore) => IDBRequest,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      op(transaction.objectStore(store));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  private txRead<T>(
    db: IDBDatabase,
    store: string,
    op: (s: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly');
      const request = op(transaction.objectStore(store));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
