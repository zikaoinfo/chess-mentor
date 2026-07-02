import { applyPersonaStyle, fallbackMove, skillForDifficulty } from './instructor.service';
import { BOT_PRESETS, BotPersona } from '../models/bot.model';

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

describe('BOT_PRESETS', () => {
  it('covers the four styles with unique ids and valid parameters', () => {
    const styles = new Set(BOT_PRESETS.map((b) => b.style));
    expect(styles).toEqual(new Set(['agressif', 'positionnel', 'defensif', 'hasardeux']));
    expect(new Set(BOT_PRESETS.map((b) => b.id)).size).toBe(BOT_PRESETS.length);
    for (const b of BOT_PRESETS) {
      expect(b.skill).toBeGreaterThanOrEqual(0);
      expect(b.skill).toBeLessThanOrEqual(20);
      expect(b.randomness).toBeGreaterThanOrEqual(0);
      expect(b.randomness).toBeLessThanOrEqual(1);
    }
  });
});

describe('applyPersonaStyle', () => {
  const base: BotPersona = {
    id: 't', name: 'T', avatar: '🤖', elo: 800, style: 'positionnel',
    intro: '', skill: 5, contempt: 0, randomness: 0, captureBias: 0,
  };
  // Black pawn on d5 can be captured by the e4 pawn; engine suggests quiet a2a3.
  const FEN = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

  it('keeps the engine move for a neutral persona', () => {
    expect(applyPersonaStyle(FEN, 'a2a3', base, () => 0.99)).toBe('a2a3');
  });

  it('randomness picks a legal move instead of the engine move', () => {
    const persona = { ...base, randomness: 0.5 };
    const uci = applyPersonaStyle(FEN, 'a2a3', persona, () => 0.1);
    expect(uci).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
  });

  it('captureBias swaps a quiet engine move for the best capture', () => {
    const persona = { ...base, captureBias: 0.9 };
    expect(applyPersonaStyle(FEN, 'a2a3', persona, () => 0.1)).toBe('e4d5');
  });

  it('captureBias keeps the engine move when it is already a capture', () => {
    const persona = { ...base, captureBias: 0.9 };
    expect(applyPersonaStyle(FEN, 'e4d5', persona, () => 0.1)).toBe('e4d5');
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
