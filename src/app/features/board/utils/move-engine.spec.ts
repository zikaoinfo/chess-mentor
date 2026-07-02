import { applySolverMove, legalTargets, replayPgn } from './move-engine';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('move-engine', () => {
  describe('legalTargets', () => {
    it('lists legal destinations for a piece', () => {
      const targets = legalTargets(START, 'e2');
      expect(targets).toContain('e3');
      expect(targets).toContain('e4');
    });

    it('returns nothing for an empty square', () => {
      expect(legalTargets(START, 'e4')).toEqual([]);
    });
  });

  describe('applySolverMove', () => {
    const solution = ['e2e4', 'e7e5', 'g1f3'];

    it('accepts the expected move and auto-plays the opponent reply', () => {
      const result = applySolverMove(START, 'e2e4', solution, 0);
      expect(result.correct).toBe(true);
      expect(result.opponentMove).toBe('e7e5');
      expect(result.solutionIndex).toBe(2);
      expect(result.solved).toBe(false);
      expect(result.fen).toContain(' w '); // back to white after the reply
    });

    it('marks the line solved on the final move', () => {
      const after = applySolverMove(START, 'e2e4', solution, 0).fen;
      const result = applySolverMove(after, 'g1f3', solution, 2);
      expect(result.correct).toBe(true);
      expect(result.solved).toBe(true);
      expect(result.opponentMove).toBeNull();
    });

    it('rejects a wrong move without changing the position', () => {
      const result = applySolverMove(START, 'd2d4', solution, 0);
      expect(result.correct).toBe(false);
      expect(result.fen).toBe(START);
      expect(result.solutionIndex).toBe(0);
    });

    it('rejects an illegal move', () => {
      const result = applySolverMove(START, 'e2e5', solution, 0);
      expect(result.correct).toBe(false);
    });
  });

  describe('replayPgn', () => {
    it('replays numberless SAN movetext (Lichess API format) to the final position', () => {
      const { fen, lastUci } = replayPgn('e4 e5 Nf3');
      expect(fen).toContain(' b '); // black to move after 2.Nf3
      expect(lastUci).toBe('g1f3');
    });

    it('tolerates numbered movetext and result markers', () => {
      const { fen, lastUci } = replayPgn('1. e4 e5 2. Nf3 Nc6 *');
      expect(fen).toContain(' w ');
      expect(lastUci).toBe('b8c6');
    });

    it('returns the start position for an empty movetext', () => {
      const { fen, lastUci } = replayPgn('');
      expect(fen).toBe(START);
      expect(lastUci).toBeNull();
    });
  });
});
