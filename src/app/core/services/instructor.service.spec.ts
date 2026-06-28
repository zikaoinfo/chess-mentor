import { fallbackMove, skillForDifficulty } from './instructor.service';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// Fool's mate — White is checkmated, no legal moves.
const MATE_FEN = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';

describe('skillForDifficulty', () => {
  it('maps each tier to an ascending Stockfish skill level', () => {
    expect(skillForDifficulty('beginner')).toBe(1);
    expect(skillForDifficulty('easy')).toBe(4);
    expect(skillForDifficulty('medium')).toBe(8);
    expect(skillForDifficulty('beginner')).toBeLessThan(skillForDifficulty('easy'));
    expect(skillForDifficulty('easy')).toBeLessThan(skillForDifficulty('medium'));
  });
});

describe('fallbackMove', () => {
  it('returns a legal UCI move for a normal position', () => {
    const uci = fallbackMove(START_FEN);
    expect(uci).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
  });

  it('returns an empty string when there are no legal moves', () => {
    expect(fallbackMove(MATE_FEN)).toBe('');
  });
});
