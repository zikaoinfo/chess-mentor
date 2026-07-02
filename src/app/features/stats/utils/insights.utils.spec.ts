import { PuzzleAttempt } from '../../../core/models/puzzle.model';
import { SavedGame } from '../../../core/models/saved-game.model';
import {
  accuracySeries,
  failedThemes,
  puzzleAccuracyPct,
  ratingSeries,
  toPolyline,
  weakestPhase,
  winrate,
} from './insights.utils';

function attempt(partial: Partial<PuzzleAttempt>): PuzzleAttempt {
  return {
    puzzleId: 'p',
    solvedAt: new Date('2026-01-01'),
    attempts: 1,
    timeMs: 1000,
    correct: true,
    ...partial,
  };
}

function game(partial: Partial<SavedGame>): SavedGame {
  return {
    id: crypto.randomUUID(),
    playedAt: new Date('2026-01-01'),
    playerColor: 'white',
    difficulty: 'beginner',
    result: 'white-wins',
    moves: [],
    ...partial,
  };
}

describe('insights.utils', () => {
  it('winrate scores wins 1, draws ½, per colour splits', () => {
    const games = [
      game({ playerColor: 'white', result: 'white-wins' }),
      game({ playerColor: 'white', result: 'black-wins' }),
      game({ playerColor: 'black', result: 'draw' }),
      game({ playerColor: 'black', result: 'black-wins' }),
    ];
    const stats = winrate(games);
    expect(stats.games).toBe(4);
    expect(stats.overallPct).toBe(63); // (1 + 0 + 0.5 + 1) / 4
    expect(stats.whitePct).toBe(50);
    expect(stats.blackPct).toBe(75);
  });

  it('winrate ignores unfinished games and handles missing colours', () => {
    const stats = winrate([game({ result: null }), game({ playerColor: 'white' })]);
    expect(stats.games).toBe(1);
    expect(stats.blackPct).toBeNull();
  });

  it('puzzleAccuracyPct + accuracySeries (rolling window)', () => {
    const attempts = [
      attempt({ correct: true }),
      attempt({ correct: false }),
      attempt({ correct: true }),
      attempt({ correct: true }),
    ];
    expect(puzzleAccuracyPct(attempts)).toBe(75);
    const series = accuracySeries(attempts, 2);
    expect(series.map((p) => p.y)).toEqual([100, 50, 50, 100]);
  });

  it('failedThemes ranks by fail rate with a minimum sample', () => {
    const attempts = [
      attempt({ themes: ['fork'], correct: false }),
      attempt({ themes: ['fork'], correct: false }),
      attempt({ themes: ['fork'], correct: true }),
      attempt({ themes: ['pin'], correct: true }),
      attempt({ themes: ['pin'], correct: true }),
      attempt({ themes: ['pin'], correct: true }),
    ];
    const failures = failedThemes(attempts, 3);
    expect(failures).toEqual([{ theme: 'fork', total: 3, failPct: 67 }]);
  });

  it('ratingSeries keeps solved puzzles chronologically', () => {
    const attempts = [
      attempt({ correct: true, rating: 1200, solvedAt: new Date('2026-01-02') }),
      attempt({ correct: true, rating: 1100, solvedAt: new Date('2026-01-01') }),
      attempt({ correct: false, rating: 1500 }),
    ];
    expect(ratingSeries(attempts).map((p) => p.y)).toEqual([1100, 1200]);
  });

  it('weakestPhase aggregates analysed games only', () => {
    expect(weakestPhase([game({})])).toBeNull();
    const analyzed = game({
      review: {
        analyzedAt: new Date(),
        player: { inaccuracy: 0, mistake: 0, blunder: 0 },
        bot: { inaccuracy: 0, mistake: 0, blunder: 0 },
        playerPhaseErrors: { opening: 1, middlegame: 4, endgame: 2 },
        evals: [],
      },
    });
    expect(weakestPhase([analyzed])).toEqual({
      phase: 'middlegame',
      errors: 4,
      analyzedGames: 1,
    });
  });

  it('toPolyline maps points into the viewBox', () => {
    const line = toPolyline([{ x: 0, y: 0 }, { x: 1, y: 10 }], 100, 30, 0);
    expect(line).toBe('0.00,30.00 100.00,0.00');
    expect(toPolyline([], 100, 30)).toBe('');
  });
});
