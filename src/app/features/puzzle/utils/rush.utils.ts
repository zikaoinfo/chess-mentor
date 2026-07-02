import { Chess } from 'chess.js';

import { RushDifficulty, RushMode, RushScore } from '../../../core/models/rush.model';

const LADDER: readonly RushDifficulty[] = ['easiest', 'easier', 'normal', 'harder', 'hardest'];

/** Progressive difficulty: one ladder step every `step` solved puzzles. */
export function targetDifficulty(solved: number, step = 3): RushDifficulty {
  return LADDER[Math.min(Math.floor(Math.max(0, solved) / step), LADDER.length - 1)];
}

/** Run duration in seconds, or null for survival (no clock). */
export function durationFor(mode: RushMode): number | null {
  switch (mode) {
    case '3min':
      return 180;
    case '5min':
      return 300;
    case 'survival':
      return null;
  }
}

/** Personal record for a mode. */
export function bestScore(scores: readonly RushScore[], mode: RushMode): number {
  return scores.filter((s) => s.mode === mode).reduce((max, s) => Math.max(max, s.score), 0);
}

/** mm:ss for the countdown. */
export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Solution UCIs replayed from the puzzle position, as readable SAN. */
export function solutionSan(fen: string, solution: readonly string[]): readonly string[] {
  try {
    const chess = new Chess(fen);
    return solution.map(
      (uci) =>
        chess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.length > 4 ? uci[4] : 'q',
        }).san,
    );
  } catch {
    return solution;
  }
}
