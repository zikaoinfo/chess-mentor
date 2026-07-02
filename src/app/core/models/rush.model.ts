/** Puzzle Rush game modes. */
export type RushMode = '3min' | '5min' | 'survival';

/** Lichess `difficulty` parameter values, easiest → hardest. */
export type RushDifficulty = 'easiest' | 'easier' | 'normal' | 'harder' | 'hardest';

/** A finished rush run, persisted locally for the personal record. */
export interface RushScore {
  readonly mode: RushMode;
  readonly score: number;
  readonly at: Date;
}
