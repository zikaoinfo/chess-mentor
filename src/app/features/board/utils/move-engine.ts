import { Chess } from 'chess.js';
import { MoveResult } from '../../../core/models/game-state.model';
import { parseUci } from './fen.utils';

/**
 * Thin functional wrapper around chess.js. chess.js owns ALL rules logic
 * (legality, check/mate, UCI ↔ SAN); the rest of the app only ever sees
 * FEN strings and UCI moves.
 */

/** Target squares of every legal move from `square`, for move-hint highlights. */
export function legalTargets(fen: string, square: string): string[] {
  const chess = new Chess(fen);
  try {
    return chess.moves({ square: square as never, verbose: true }).map((m) => m.to);
  } catch {
    return [];
  }
}

/** UCI of the move actually played, including promotion suffix when relevant. */
function toUci(move: { from: string; to: string; promotion?: string }): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

/**
 * Apply a solver's candidate move against the puzzle solution.
 *
 * Convention (Lichess API): the puzzle FEN is the position AFTER the
 * opponent's blunder — the solver moves first. The solver plays the even
 * indices of `solution`; odd indices are auto-played opponent replies.
 * `solutionIndex` is the index the solver is expected to play now.
 */
export function applySolverMove(
  fen: string,
  uci: string,
  solution: readonly string[],
  solutionIndex: number,
): MoveResult {
  const expected = solution[solutionIndex];
  const chess = new Chess(fen);
  const { from, to, promotion } = parseUci(uci);

  let played: { from: string; to: string; promotion?: string } | null = null;
  try {
    played = chess.move({ from, to, promotion: promotion ?? 'q' });
  } catch {
    played = null;
  }

  if (!played || toUci(played) !== expected) {
    return {
      correct: false,
      fen,
      solved: false,
      opponentMove: null,
      solutionIndex,
    };
  }

  let nextIndex = solutionIndex + 1;
  let opponentMove: string | null = null;

  // Auto-play the opponent's scripted reply, if the line continues.
  if (nextIndex < solution.length) {
    const reply = parseUci(solution[nextIndex]);
    chess.move({ from: reply.from, to: reply.to, promotion: reply.promotion ?? 'q' });
    opponentMove = solution[nextIndex];
    nextIndex += 1;
  }

  return {
    correct: true,
    fen: chess.fen(),
    solved: nextIndex >= solution.length,
    opponentMove,
    solutionIndex: nextIndex,
  };
}

/**
 * Replay a full game movetext (as served by the Lichess API: SAN tokens,
 * with or without move numbers) and return the final position plus the last
 * move in UCI. The API's `game.pgn` ends exactly at the puzzle position, so
 * this yields the FEN the solver plays from and the opponent's blunder to
 * highlight.
 */
export function replayPgn(pgn: string): { fen: string; lastUci: string | null } {
  const chess = new Chess();
  let lastUci: string | null = null;
  for (const token of pgn.trim().split(/\s+/)) {
    // Skip empty tokens, move numbers ("12." / "12..."), and results.
    if (!token || /^\d+\.+$/.test(token) || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) continue;
    const san = token.replace(/^\d+\.+/, '');
    if (!san) continue;
    const move = chess.move(san);
    lastUci = toUci(move);
  }
  return { fen: chess.fen(), lastUci };
}
