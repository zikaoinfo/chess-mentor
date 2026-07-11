import { isOffTheme, puzzleUrl, toPuzzle } from './puzzle.service';
import { LichessApiResponse, PuzzleTheme } from '../models/puzzle.model';

const BASE = 'https://lichess.org/api';

// Every theme the trainer exposes — the tests below cover them all.
const THEMES: readonly PuzzleTheme[] = ['mix', 'fork', 'pin', 'mateIn1', 'mateIn2'];

describe('puzzleUrl', () => {
  it('mix → unfiltered endpoint, no query', () => {
    expect(puzzleUrl(BASE, 'mix')).toBe('https://lichess.org/api/puzzle/next');
  });

  // Filters go through `angle`, NOT `themes` (which Lichess ignores → random).
  for (const theme of THEMES.filter((t) => t !== 'mix')) {
    it(`${theme} → ?angle=${theme} (never themes=)`, () => {
      const url = puzzleUrl(BASE, theme);
      expect(url).toBe(`https://lichess.org/api/puzzle/next?angle=${theme}`);
      expect(url).not.toContain('themes=');
    });
  }

  it('Clouage (pin) uses angle=pin', () => {
    expect(puzzleUrl(BASE, 'pin')).toBe('https://lichess.org/api/puzzle/next?angle=pin');
  });
});

describe('isOffTheme', () => {
  it('mix accepts any puzzle, whatever its themes', () => {
    expect(isOffTheme('mix', [])).toBe(false);
    expect(isOffTheme('mix', ['fork', 'endgame'])).toBe(false);
  });

  // For every themed request: matching puzzle passes, non-matching is skipped.
  for (const theme of THEMES.filter((t) => t !== 'mix')) {
    it(`${theme}: puzzle carrying the theme is kept`, () => {
      expect(isOffTheme(theme, [theme, 'middlegame'])).toBe(false);
    });
    it(`${theme}: puzzle missing the theme is off-theme`, () => {
      expect(isOffTheme(theme, ['advantage', 'crushing'])).toBe(true);
    });
  }

  it('pin (Clouage): a fork puzzle is off-theme, a pin puzzle is not', () => {
    expect(isOffTheme('pin', ['fork'])).toBe(true);
    expect(isOffTheme('pin', ['pin', 'long'])).toBe(false);
  });
});

describe('toPuzzle', () => {
  it('replays the pgn to the solver position and keeps the themes', () => {
    const res: LichessApiResponse = {
      game: { id: 'g1', pgn: 'e4 e5 Qh5 Nc6 Bc4 Nf6' },
      puzzle: { id: 'p1', rating: 900, themes: ['mateIn1', 'mate'], solution: ['h5f7'], initialPly: 6 },
    };
    const puzzle = toPuzzle(res);
    expect(puzzle.id).toBe('p1');
    expect(puzzle.themes).toEqual(['mateIn1', 'mate']);
    expect(puzzle.solution).toEqual(['h5f7']);
    expect(puzzle.fen).toContain(' w '); // White (the solver) to move
  });
});
