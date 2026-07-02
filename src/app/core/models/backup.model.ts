import { PuzzleAttempt } from './puzzle.model';
import { SavedGame } from './saved-game.model';
import { RepertoireEntry } from './opening.model';
import { RushScore } from './rush.model';
import { DrillProgress } from './drill.model';

/**
 * Portable snapshot of every local store — the app's data lives only in
 * IndexedDB, so this file is the user's escape hatch when changing device.
 */
export interface ChessMentorBackup {
  readonly version: 1;
  readonly exportedAt: string; // ISO date
  readonly attempts: readonly PuzzleAttempt[];
  readonly games: readonly SavedGame[];
  readonly repertoire: readonly RepertoireEntry[];
  readonly rush: readonly RushScore[];
  readonly drills: readonly DrillProgress[];
}

/** Structural check on a parsed JSON file (dates stay ISO strings here). */
export function isBackup(value: unknown): value is ChessMentorBackup {
  if (typeof value !== 'object' || value === null) return false;
  const b = value as Record<string, unknown>;
  return (
    b['version'] === 1 &&
    Array.isArray(b['attempts']) &&
    Array.isArray(b['games']) &&
    Array.isArray(b['repertoire']) &&
    Array.isArray(b['rush']) &&
    Array.isArray(b['drills'])
  );
}
