import { PieceColor } from '../../../core/models/game-state.model';

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface Piece {
  readonly color: PieceColor;
  readonly type: PieceType;
}

/** One square of the board, ready to render. */
export interface BoardSquare {
  /** Algebraic name, e.g. `'e4'`. */
  readonly name: string;
  /** 0 = file a … 7 = file h. */
  readonly file: number;
  /** 0 = rank 1 … 7 = rank 8. */
  readonly rank: number;
  /** `true` for a light-coloured square. */
  readonly light: boolean;
  readonly piece: Piece | null;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

/** Algebraic name for zero-based file/rank indices. */
export function squareName(file: number, rank: number): string {
  return `${FILES[file]}${rank + 1}`;
}

/** Whether the square at the given indices is light-coloured. */
export function isLightSquare(file: number, rank: number): boolean {
  return (file + rank) % 2 === 1;
}

function pieceFromChar(char: string): Piece {
  const color: PieceColor = char === char.toUpperCase() ? 'w' : 'b';
  return { color, type: char.toLowerCase() as PieceType };
}

/**
 * Parse the placement field of a FEN string into 64 squares.
 *
 * Squares are returned in board order from a8 (top-left, index 0) to
 * h1 (bottom-right, index 63) — i.e. White's point of view, reading order.
 * The component reverses this list to flip the board for Black.
 */
export function fenToBoard(fen: string): BoardSquare[] {
  const placement = fen.trim().split(' ')[0];
  const rows = placement.split('/');
  if (rows.length !== 8) {
    throw new Error(`Invalid FEN: expected 8 ranks, got ${rows.length}`);
  }

  const squares: BoardSquare[] = [];
  // FEN ranks are listed 8 → 1.
  for (let rowIdx = 0; rowIdx < 8; rowIdx++) {
    const rank = 7 - rowIdx; // 0-based rank index (rank 8 first)
    let file = 0;
    for (const char of rows[rowIdx]) {
      if (char >= '1' && char <= '8') {
        const empty = Number(char);
        for (let i = 0; i < empty; i++) {
          squares.push(buildSquare(file, rank, null));
          file++;
        }
      } else {
        squares.push(buildSquare(file, rank, pieceFromChar(char)));
        file++;
      }
    }
    if (file !== 8) {
      throw new Error(`Invalid FEN rank "${rows[rowIdx]}": ${file} files`);
    }
  }
  return squares;
}

function buildSquare(file: number, rank: number, piece: Piece | null): BoardSquare {
  return {
    name: squareName(file, rank),
    file,
    rank,
    light: isLightSquare(file, rank),
    piece,
  };
}

/** Side to move encoded in a FEN string (defaults to White if absent). */
export function fenTurn(fen: string): PieceColor {
  const field = fen.trim().split(' ')[1];
  return field === 'b' ? 'b' : 'w';
}

/** Split a UCI move (`'e2e4'`, `'e7e8q'`) into its parts. */
export function parseUci(uci: string): { from: string; to: string; promotion?: PieceType } {
  const promotion = uci.length > 4 ? (uci[4] as PieceType) : undefined;
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion };
}
