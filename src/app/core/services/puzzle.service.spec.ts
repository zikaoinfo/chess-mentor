import { puzzleUrl, toPuzzle } from './puzzle.service';
import { LichessApiResponse } from '../models/puzzle.model';

describe('puzzleUrl', () => {
  const BASE = 'https://lichess.org/api';

  it('mix → unfiltered endpoint, no query', () => {
    expect(puzzleUrl(BASE, 'mix')).toBe('https://lichess.org/api/puzzle/next');
  });

  it('filters by theme through the `angle` param (not `themes`)', () => {
    // The whole point of the fix: Lichess ignores `themes` and returns a
    // random puzzle; `angle` is the parameter that actually filters.
    expect(puzzleUrl(BASE, 'mateIn1')).toBe('https://lichess.org/api/puzzle/next?angle=mateIn1');
    expect(puzzleUrl(BASE, 'fork')).toContain('?angle=fork');
    expect(puzzleUrl(BASE, 'mateIn1')).not.toContain('themes=');
  });
});

describe('toPuzzle', () => {
  it('replays the pgn to the solver position and keeps the themes', () => {
    const res: LichessApiResponse = {
      game: { id: 'g1', pgn: 'e4 e5 Qh5 Nc6 Bc4 Nf6' },
      puzzle: { id: 'p1', rating: 900, themes: ['mateIn1'], solution: ['h5f7'], initialPly: 6 },
    };
    const puzzle = toPuzzle(res);
    expect(puzzle.id).toBe('p1');
    expect(puzzle.themes).toEqual(['mateIn1']);
    expect(puzzle.solution).toEqual(['h5f7']);
    expect(puzzle.fen).toContain(' w '); // White (the solver) to move
  });
});
