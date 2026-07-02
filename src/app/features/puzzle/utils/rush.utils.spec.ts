import { bestScore, durationFor, formatClock, targetDifficulty } from './rush.utils';
import { RushScore } from '../../../core/models/rush.model';

describe('rush.utils', () => {
  it('targetDifficulty climbs one step every 3 solves and caps at hardest', () => {
    expect(targetDifficulty(0)).toBe('easiest');
    expect(targetDifficulty(2)).toBe('easiest');
    expect(targetDifficulty(3)).toBe('easier');
    expect(targetDifficulty(6)).toBe('normal');
    expect(targetDifficulty(9)).toBe('harder');
    expect(targetDifficulty(12)).toBe('hardest');
    expect(targetDifficulty(100)).toBe('hardest');
  });

  it('durationFor maps modes', () => {
    expect(durationFor('3min')).toBe(180);
    expect(durationFor('5min')).toBe(300);
    expect(durationFor('survival')).toBeNull();
  });

  it('bestScore is per-mode', () => {
    const scores: RushScore[] = [
      { mode: '3min', score: 7, at: new Date() },
      { mode: '3min', score: 12, at: new Date() },
      { mode: 'survival', score: 20, at: new Date() },
    ];
    expect(bestScore(scores, '3min')).toBe(12);
    expect(bestScore(scores, 'survival')).toBe(20);
    expect(bestScore(scores, '5min')).toBe(0);
  });

  it('formatClock renders mm:ss', () => {
    expect(formatClock(180)).toBe('3:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(0)).toBe('0:00');
  });
});
