import { classify, isSacrifice, materialOf, phaseOf, toWhiteCp } from './review.utils';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('review.utils', () => {
  describe('classify', () => {
    it('applies the standard centipawn-loss thresholds', () => {
      expect(classify(400, false, false)).toBe('blunder');
      expect(classify(300, false, false)).toBe('blunder');
      expect(classify(150, false, false)).toBe('mistake');
      expect(classify(60, false, false)).toBe('inaccuracy');
      expect(classify(10, false, false)).toBe('good');
    });

    it('marks the engine move as best, brilliant when sacrificing', () => {
      expect(classify(0, true, false)).toBe('best');
      expect(classify(0, true, true)).toBe('brilliant');
    });
  });

  describe('toWhiteCp', () => {
    it('keeps cp for white to move, negates for black to move', () => {
      expect(toWhiteCp({ uci: null, cp: 120, mate: null }, true)).toBe(120);
      expect(toWhiteCp({ uci: null, cp: 120, mate: null }, false)).toBe(-120);
    });

    it('folds mates near ±MATE_SCORE, closer mates scoring higher', () => {
      const m2 = toWhiteCp({ uci: null, cp: null, mate: 2 }, true);
      const m8 = toWhiteCp({ uci: null, cp: null, mate: 8 }, true);
      expect(m2).toBeGreaterThan(m8);
      expect(m8).toBeGreaterThan(1000);
      expect(toWhiteCp({ uci: null, cp: null, mate: -3 }, true)).toBeLessThan(-1000);
    });
  });

  it('phaseOf buckets by ply then by remaining material', () => {
    expect(phaseOf(START, 4)).toBe('opening');
    expect(phaseOf(START, 24)).toBe('middlegame');
    expect(phaseOf('4k3/8/8/8/8/8/4P3/4K3 w - - 0 40', 60)).toBe('endgame');
  });

  it('materialOf counts standard piece values', () => {
    expect(materialOf(START, 'w')).toBe(8 + 3 + 3 + 3 + 3 + 5 + 5 + 9);
    expect(materialOf('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', 'w')).toBe(1);
  });

  it('isSacrifice detects a ≥2-point material dip two plies later', () => {
    const fens = [
      'r3k3/8/8/8/8/8/8/R3K3 w - - 0 1', // white rook on board
      'r3k3/8/8/8/8/8/8/R3K3 b - - 0 1', // (placeholder mid position)
      '4k3/8/8/8/8/8/8/4K3 w - - 0 2', // white rook gone
    ];
    expect(isSacrifice(fens, 0, 'w')).toBe(true);
    expect(isSacrifice(fens, 0, 'b')).toBe(true);
    expect(isSacrifice(fens.slice(0, 2), 0, 'w')).toBe(false); // no reply yet
  });
});
