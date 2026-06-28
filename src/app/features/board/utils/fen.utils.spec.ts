import { fenToBoard, fenTurn, isLightSquare, parseUci, squareName } from './fen.utils';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('fen.utils', () => {
  describe('fenToBoard', () => {
    it('produces 64 squares', () => {
      expect(fenToBoard(START)).toHaveLength(64);
    });

    it('orders squares from a8 (index 0) to h1 (index 63)', () => {
      const board = fenToBoard(START);
      expect(board[0].name).toBe('a8');
      expect(board[63].name).toBe('h1');
    });

    it('places pieces with the right colour and type', () => {
      const board = fenToBoard(START);
      expect(board[0].piece).toEqual({ color: 'b', type: 'r' });
      const e1 = board.find((s) => s.name === 'e1');
      expect(e1?.piece).toEqual({ color: 'w', type: 'k' });
      expect(board.find((s) => s.name === 'e4')?.piece).toBeNull();
    });

    it('rejects malformed FEN', () => {
      expect(() => fenToBoard('not/a/fen')).toThrow();
    });
  });

  it('squareName maps indices to algebraic', () => {
    expect(squareName(0, 0)).toBe('a1');
    expect(squareName(4, 3)).toBe('e4');
    expect(squareName(7, 7)).toBe('h8');
  });

  it('isLightSquare matches the board colouring (a1 is dark)', () => {
    expect(isLightSquare(0, 0)).toBe(false);
    expect(isLightSquare(1, 0)).toBe(true);
  });

  it('fenTurn reads the side to move', () => {
    expect(fenTurn(START)).toBe('w');
    expect(fenTurn('4k3/8/8/8/8/8/8/4K3 b - - 0 1')).toBe('b');
  });

  it('parseUci splits source, target and promotion', () => {
    expect(parseUci('e2e4')).toEqual({ from: 'e2', to: 'e4', promotion: undefined });
    expect(parseUci('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
  });
});
