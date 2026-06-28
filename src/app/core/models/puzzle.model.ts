/**
 * Domain model for a single tactical puzzle, normalised from the Lichess API.
 * Everything is `readonly` — puzzles are immutable once loaded.
 */
export interface LichessPuzzle {
  readonly id: string;
  readonly rating: number;
  readonly themes: readonly string[];
  /** Moves in UCI notation, e.g. `'e2e4'`. Index 0 is the opponent's setup move. */
  readonly solution: readonly string[];
  /** Position the solver starts from, in Forsyth–Edwards Notation. */
  readonly fen: string;
}

/** A recorded attempt at a puzzle — persisted for progression stats. */
export interface PuzzleAttempt {
  readonly puzzleId: string;
  readonly solvedAt: Date;
  readonly attempts: number;
  readonly timeMs: number;
  readonly correct: boolean;
}

/**
 * Raw shape returned by `GET https://lichess.org/api/puzzle/next`.
 * The API does not hand back a FEN directly — the position is reconstructed
 * by replaying `game.pgn` up to `puzzle.initialPly` (see `PuzzleService`).
 */
export interface LichessApiResponse {
  readonly game: {
    readonly id: string;
    readonly pgn: string;
  };
  readonly puzzle: {
    readonly id: string;
    readonly rating: number;
    readonly themes: readonly string[];
    readonly solution: readonly string[];
    readonly initialPly: number;
  };
}

/** Puzzle themes surfaced in the UI. Maps to Lichess theme ids. */
export type PuzzleTheme = 'mix' | 'fork' | 'pin' | 'mateIn1' | 'mateIn2';
