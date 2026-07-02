import { PuzzleAttempt } from '../../../core/models/puzzle.model';
import { SavedGame } from '../../../core/models/saved-game.model';
import { GamePhase } from '../../../core/models/analysis.model';

export interface WinrateStats {
  readonly games: number;
  readonly overallPct: number;
  readonly whitePct: number | null;
  readonly blackPct: number | null;
}

/** Player winrate, overall and per colour (draws count ½). */
export function winrate(games: readonly SavedGame[]): WinrateStats {
  const finished = games.filter((g) => g.result !== null);
  const score = (subset: readonly SavedGame[]): number | null => {
    if (subset.length === 0) return null;
    let points = 0;
    for (const g of subset) {
      if (g.result === 'draw') points += 0.5;
      else if (
        (g.result === 'white-wins' && g.playerColor === 'white') ||
        (g.result === 'black-wins' && g.playerColor === 'black')
      ) {
        points += 1;
      }
    }
    return Math.round((points / subset.length) * 100);
  };
  return {
    games: finished.length,
    overallPct: score(finished) ?? 0,
    whitePct: score(finished.filter((g) => g.playerColor === 'white')),
    blackPct: score(finished.filter((g) => g.playerColor === 'black')),
  };
}

/** Share of clean puzzle solves, in percent. */
export function puzzleAccuracyPct(attempts: readonly PuzzleAttempt[]): number {
  if (attempts.length === 0) return 0;
  return Math.round((attempts.filter((a) => a.correct).length / attempts.length) * 100);
}

export interface ThemeFailure {
  readonly theme: string;
  readonly total: number;
  readonly failPct: number;
}

/** Themes ranked by failure rate (min. 3 attempts to be significant). */
export function failedThemes(attempts: readonly PuzzleAttempt[], min = 3): ThemeFailure[] {
  const byTheme = new Map<string, { total: number; failed: number }>();
  for (const a of attempts) {
    for (const theme of a.themes ?? []) {
      const entry = byTheme.get(theme) ?? { total: 0, failed: 0 };
      entry.total += 1;
      if (!a.correct) entry.failed += 1;
      byTheme.set(theme, entry);
    }
  }
  return [...byTheme.entries()]
    .filter(([, v]) => v.total >= min && v.failed > 0)
    .map(([theme, v]) => ({ theme, total: v.total, failPct: Math.round((v.failed / v.total) * 100) }))
    .sort((a, b) => b.failPct - a.failPct)
    .slice(0, 6);
}

export interface SeriesPoint {
  readonly x: number; // 0-based index in chronological order
  readonly y: number;
}

/** Ratings of solved puzzles in chronological order (a progression proxy). */
export function ratingSeries(attempts: readonly PuzzleAttempt[]): SeriesPoint[] {
  return [...attempts]
    .filter((a) => a.correct && a.rating !== undefined)
    .sort((a, b) => new Date(a.solvedAt).getTime() - new Date(b.solvedAt).getTime())
    .map((a, i) => ({ x: i, y: a.rating as number }));
}

/** Rolling accuracy (%) over a sliding window, chronological. */
export function accuracySeries(attempts: readonly PuzzleAttempt[], window = 10): SeriesPoint[] {
  const ordered = [...attempts].sort(
    (a, b) => new Date(a.solvedAt).getTime() - new Date(b.solvedAt).getTime(),
  );
  return ordered.map((_, i) => {
    const slice = ordered.slice(Math.max(0, i - window + 1), i + 1);
    return { x: i, y: puzzleAccuracyPct(slice) };
  });
}

export interface Weakness {
  readonly phase: GamePhase;
  readonly errors: number;
  readonly analyzedGames: number;
}

const PHASES: readonly GamePhase[] = ['opening', 'middlegame', 'endgame'];

/** Phase where the player leaks the most points, from analysed games. */
export function weakestPhase(games: readonly SavedGame[]): Weakness | null {
  const analyzed = games.filter((g) => g.review);
  if (analyzed.length === 0) return null;
  const totals: Record<GamePhase, number> = { opening: 0, middlegame: 0, endgame: 0 };
  for (const g of analyzed) {
    for (const phase of PHASES) {
      totals[phase] += g.review?.playerPhaseErrors[phase] ?? 0;
    }
  }
  const worst = PHASES.reduce((a, b) => (totals[b] > totals[a] ? b : a));
  return { phase: worst, errors: totals[worst], analyzedGames: analyzed.length };
}

/** Map series points into an SVG polyline string for a w×h viewBox. */
export function toPolyline(
  points: readonly SeriesPoint[],
  width: number,
  height: number,
  pad = 2,
): string {
  if (points.length === 0) return '';
  const ys = points.map((p) => p.y);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const span = yMax - yMin || 1;
  const n = points.length;
  return points
    .map((p, i) => {
      const x = n === 1 ? width / 2 : (i / (n - 1)) * width;
      const y = height - pad - ((p.y - yMin) / span) * (height - pad * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}
