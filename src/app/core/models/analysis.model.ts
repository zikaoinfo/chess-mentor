/** Move quality classes, à la Chess.com Game Review. */
export type MoveClass = 'brilliant' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export type GamePhase = 'opening' | 'middlegame' | 'endgame';

/** Per-move evaluation produced by the game review. Evals are white-perspective centipawns (mates folded to ±MATE_SCORE range). */
export interface MoveEval {
  /** 1-based ply number of the move. */
  readonly ply: number;
  readonly san: string;
  readonly uci: string;
  readonly by: 'player' | 'bot';
  readonly evalBefore: number;
  readonly evalAfter: number;
  /** Signed mate distance after the move (white perspective), if forced. */
  readonly mateAfter: number | null;
  /** Engine best move (UCI) from the position before the move. */
  readonly bestUci: string | null;
  readonly cls: MoveClass;
  readonly phase: GamePhase;
}

export interface ReviewCounts {
  readonly inaccuracy: number;
  readonly mistake: number;
  readonly blunder: number;
}

/** Result of a full game analysis, persisted with the game. */
export interface GameReview {
  readonly analyzedAt: Date;
  readonly player: ReviewCounts;
  readonly bot: ReviewCounts;
  /** Player errors (inaccuracy+mistake+blunder) bucketed by game phase. */
  readonly playerPhaseErrors: Readonly<Record<GamePhase, number>>;
  readonly evals: readonly MoveEval[];
}
