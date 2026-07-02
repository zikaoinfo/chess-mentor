import { Chess } from 'chess.js';

const VALUE: Readonly<Record<string, number>> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const DISPLAY_ORDER = ['p', 'n', 'b', 'r', 'q'];

export interface CaptureSummary {
  /** Types of the (black) pieces White has captured, cheapest first. */
  readonly byWhite: readonly string[];
  /** Types of the (white) pieces Black has captured, cheapest first. */
  readonly byBlack: readonly string[];
  /** Material balance in points — positive means White is ahead. */
  readonly diff: number;
}

const EMPTY: CaptureSummary = { byWhite: [], byBlack: [], diff: 0 };

/**
 * Replay a game (UCI moves from the standard start) and collect what each
 * side captured, chess.com-style: piece rows + a single "+N" advantage.
 */
export function captureSummary(uciMoves: readonly string[]): CaptureSummary {
  const chess = new Chess();
  const byWhite: string[] = [];
  const byBlack: string[] = [];
  for (const uci of uciMoves) {
    try {
      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      });
      if (move.captured) (move.color === 'w' ? byWhite : byBlack).push(move.captured);
    } catch {
      return EMPTY; // corrupted history — never break the page over a badge
    }
  }
  const points = (arr: readonly string[]): number =>
    arr.reduce((total, p) => total + (VALUE[p] ?? 0), 0);
  const sorted = (arr: readonly string[]): readonly string[] =>
    [...arr].sort((a, b) => DISPLAY_ORDER.indexOf(a) - DISPLAY_ORDER.indexOf(b));
  return {
    byWhite: sorted(byWhite),
    byBlack: sorted(byBlack),
    diff: points(byWhite) - points(byBlack),
  };
}
