/** Side a player or piece belongs to. */
export type PieceColor = 'w' | 'b';

/** Board orientation — which colour sits at the bottom of the board. */
export type Orientation = 'white' | 'black';

/** Lifecycle of the puzzle currently being solved. */
export type PuzzleStatus = 'idle' | 'loading' | 'playing' | 'solved' | 'failed' | 'solution-shown';

/**
 * Live state of the position the solver is interacting with.
 * `fen` is the single source of truth for what is rendered.
 */
export interface GameState {
  readonly fen: string;
  readonly orientation: Orientation;
  /** Index into `LichessPuzzle.solution` of the next move expected from the solver. */
  readonly solutionIndex: number;
  readonly status: PuzzleStatus;
}

/**
 * Outcome of applying a solver move to the current position.
 * Returned by the move engine and consumed by the store.
 */
export interface MoveResult {
  readonly correct: boolean;
  /** Position after the solver move (and any auto-played opponent reply). */
  readonly fen: string;
  /** True when the move just played completes the whole solution. */
  readonly solved: boolean;
  /** Opponent reply that was auto-played, in UCI, when the move was correct. */
  readonly opponentMove: string | null;
  /** Index of the next solver move after this result. */
  readonly solutionIndex: number;
}
