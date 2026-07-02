import { GamePhase, MoveClass } from '../../../core/models/analysis.model';
import { EngineResult } from '../../../core/services/stockfish-engine';

/** Cap used when folding mate scores into the centipawn scale. */
export const MATE_SCORE = 1500;

/**
 * Fold an engine result into a single white-perspective centipawn number.
 * Stockfish reports from the side to move; mates map near ±MATE_SCORE,
 * closer mates scoring higher.
 */
export function toWhiteCp(result: EngineResult, whiteToMove: boolean): number {
  const raw =
    result.mate !== null
      ? Math.sign(result.mate) * (MATE_SCORE - Math.min(Math.abs(result.mate), 50) * 10)
      : (result.cp ?? 0);
  return whiteToMove ? raw : -raw;
}

/**
 * Classify a move from the mover's centipawn loss.
 * `dropCp` = eval before − eval after, from the mover's perspective
 * (positive = the move lost ground).
 */
export function classify(dropCp: number, playedBest: boolean, sacrifice: boolean): MoveClass {
  if (playedBest) return sacrifice ? 'brilliant' : 'best';
  if (dropCp >= 300) return 'blunder';
  if (dropCp >= 100) return 'mistake';
  if (dropCp >= 50) return 'inaccuracy';
  return 'good';
}

/** Rough phase bucketing: early plies = opening, few remaining pieces = endgame. */
export function phaseOf(fen: string, ply: number): GamePhase {
  if (ply <= 16) return 'opening';
  const placement = fen.split(' ')[0];
  const majorsAndMinors = (placement.match(/[nbrqNBRQ]/g) ?? []).length;
  return majorsAndMinors <= 6 ? 'endgame' : 'middlegame';
}

const PIECE_VALUES: Readonly<Record<string, number>> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

/** Simple material count (pawns=1, minors=3, rook=5, queen=9) for one side. */
export function materialOf(fen: string, color: 'w' | 'b'): number {
  const placement = fen.split(' ')[0];
  let total = 0;
  for (const ch of placement) {
    const isWhite = ch >= 'A' && ch <= 'Z';
    if ((color === 'w') !== isWhite) continue;
    total += PIECE_VALUES[ch.toLowerCase()] ?? 0;
  }
  return total;
}

/**
 * Sacrifice heuristic for "brilliant": after the opponent's actual reply, the
 * mover is down ≥2 points of material compared to before their move.
 * `fens[i]` is the position before ply i (0-based); needs `fens[ply + 2]`.
 */
export function isSacrifice(fens: readonly string[], plyIndex: number, mover: 'w' | 'b'): boolean {
  const after = fens[plyIndex + 2];
  if (!after) return false;
  return materialOf(fens[plyIndex], mover) - materialOf(after, mover) >= 2;
}
