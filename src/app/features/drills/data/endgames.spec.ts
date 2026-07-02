import { Chess } from 'chess.js';
import { DRILLS } from './endgames';

describe('endgame drills data', () => {
  it('has unique ids and at least two categories', () => {
    expect(new Set(DRILLS.map((d) => d.id)).size).toBe(DRILLS.length);
    expect(new Set(DRILLS.map((d) => d.category)).size).toBeGreaterThanOrEqual(3);
  });

  it('every FEN is legal, White to move, not already over', () => {
    for (const drill of DRILLS) {
      const chess = new Chess(drill.fen); // throws if invalid
      expect(chess.turn()).toBe('w');
      expect(chess.isGameOver()).toBe(false);
    }
  });

  it('mate drills give White a major piece; promote drills a pawn', () => {
    for (const drill of DRILLS) {
      const placement = drill.fen.split(' ')[0];
      if (drill.goal === 'mate') {
        expect(/[QR]/.test(placement)).toBe(true);
      } else {
        expect(placement.includes('P')).toBe(true);
      }
    }
  });
});
