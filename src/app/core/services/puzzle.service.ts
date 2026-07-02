import { computed, inject, Injectable, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { LICHESS_API_URL } from '../tokens/api.tokens';
import { LichessApiResponse, LichessPuzzle, PuzzleTheme } from '../models/puzzle.model';
import { replayPgn } from '../../features/board/utils/move-engine';

/**
 * Normalise a raw Lichess response into our domain model. The API's
 * `game.pgn` ends exactly at the puzzle position (its last ply is the
 * opponent's blunder) — replay it in full: the resulting FEN is the solver's
 * position and `solution[0]` is the solver's first move.
 */
export function toPuzzle(res: LichessApiResponse): LichessPuzzle {
  const { fen, lastUci } = replayPgn(res.game.pgn);
  return {
    id: res.puzzle.id,
    rating: res.puzzle.rating,
    themes: res.puzzle.themes,
    solution: res.puzzle.solution,
    fen,
    lastMove: lastUci,
  };
}

/**
 * Fetches puzzles from the Lichess API. Reads go through `httpResource`, which
 * tracks loading/error/value for us; `next()` re-runs the request to pull a
 * fresh puzzle, and `setTheme()` switches the requested theme.
 */
@Injectable({ providedIn: 'root' })
export class PuzzleService {
  private readonly apiUrl = inject(LICHESS_API_URL);

  /** Currently requested theme (`'mix'` hits the unfiltered endpoint). */
  readonly theme = signal<PuzzleTheme>('mix');

  /** Raw resource — re-runs whenever `theme()` changes or `next()` is called. */
  private readonly resource = httpResource<LichessApiResponse>(() => {
    const theme = this.theme();
    const base = `${this.apiUrl}/puzzle/next`;
    return theme === 'mix' ? base : `${base}?themes=${theme}`;
  });

  /** Normalised puzzle, or `null` while loading or on error. */
  readonly puzzle = computed<LichessPuzzle | null>(() => {
    const value = this.resource.value();
    return value ? toPuzzle(value) : null;
  });

  readonly isLoading = this.resource.isLoading;
  readonly error = this.resource.error;

  /** Switch theme; the resource refetches automatically. */
  setTheme(theme: PuzzleTheme): void {
    this.theme.set(theme);
  }

  /** Pull a fresh puzzle for the current theme. */
  next(): void {
    this.resource.reload();
  }
}
