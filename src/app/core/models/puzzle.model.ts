/**
 * Domain model for a single tactical puzzle, normalised from the Lichess API.
 * Everything is `readonly` — puzzles are immutable once loaded.
 */
export interface LichessPuzzle {
  readonly id: string;
  readonly rating: number;
  readonly themes: readonly string[];
  /**
   * Moves in UCI notation, e.g. `'e2e4'`. API convention: index 0 is the
   * SOLVER's first move (the position already includes the opponent's
   * blunder); odd indices are the opponent's scripted replies.
   */
  readonly solution: readonly string[];
  /** Position the solver starts from, in Forsyth–Edwards Notation. */
  readonly fen: string;
  /** Last move of the game PGN (the opponent's blunder), UCI — for highlighting. */
  readonly lastMove: string | null;
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
 * The API does not hand back a FEN directly — the puzzle position is the one
 * reached after replaying the WHOLE `game.pgn` (whose last ply is
 * `puzzle.initialPly`, 0-indexed). The solver moves first from there.
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
