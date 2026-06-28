import { Chess } from 'chess.js';
import { MoveResult, Orientation } from '../../../core/models/game-state.model';
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
 * Convention (matches Lichess): the puzzle FEN is the position before the
 * opponent's setup move; `solution[0]` is that opponent move and is auto-played
 * before the solver starts. The solver then plays the odd indices, with even
 * indices auto-played as replies. `solutionIndex` is the index the solver is
 * expected to play now.
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
 * Prepare a puzzle for solving: auto-play the opponent's setup move
 * (`solution[0]`) and report the position the solver faces, the orientation
 * (solver's colour at the bottom) and the index of the solver's first move.
 */
export function setupPuzzle(
  fen: string,
  solution: readonly string[],
): { fen: string; orientation: Orientation; solutionIndex: number } {
  const chess = new Chess(fen);
  if (solution.length > 0) {
    const first = parseUci(solution[0]);
    try {
      chess.move({ from: first.from, to: first.to, promotion: first.promotion ?? 'q' });
    } catch {
      // Leave the position untouched if the setup move is unplayable.
    }
  }
  const orientation: Orientation = chess.turn() === 'w' ? 'white' : 'black';
  return { fen: chess.fen(), orientation, solutionIndex: 1 };
}

/**
 * Reconstruct the FEN of a puzzle position by replaying a game PGN up to a
 * given ply. Used to normalise the Lichess API response, which ships a PGN +
 * `initialPly` rather than a FEN.
 */
export function fenAfterPly(pgn: string, ply: number): string {
  const full = new Chess();
  full.loadPgn(pgn);
  const history = full.history();

  const replay = new Chess();
  const limit = Math.max(0, Math.min(ply, history.length));
  for (let i = 0; i < limit; i++) {
    replay.move(history[i]);
  }
  return replay.fen();
}
