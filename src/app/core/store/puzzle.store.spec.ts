import { TestBed } from '@angular/core/testing';
import { PuzzleStore } from './puzzle.store';
import { LichessPuzzle } from '../models/puzzle.model';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// After the auto-played setup move 1.e4, it is Black to move and the solver
// must find 1...e5.
const PUZZLE: LichessPuzzle = {
  id: 'test1',
  rating: 1500,
  themes: ['fork'],
  solution: ['e2e4', 'e7e5'],
  fen: START,
};

describe('PuzzleStore', () => {
  let store: InstanceType<typeof PuzzleStore>;

  beforeEach(() => {
    store = TestBed.inject(PuzzleStore);
  });

  it('loads a puzzle and orients to the solver', () => {
    store.loadPuzzle(PUZZLE);
    expect(store.game().status).toBe('playing');
    expect(store.game().orientation).toBe('black');
    expect(store.game().solutionIndex).toBe(1);
  });

  it('solves the puzzle on the correct move and grows the streak', () => {
    store.loadPuzzle(PUZZLE);
    store.attemptMove('e7e5');
    expect(store.isSolved()).toBe(true);
    expect(store.lastMoveCorrect()).toBe(true);
    expect(store.solvedCount()).toBe(1);
    expect(store.streak()).toBe(1);
  });

  it('rejects a wrong move and resets the streak', () => {
    store.loadPuzzle(PUZZLE);
    store.attemptMove('a7a6');
    expect(store.lastMoveCorrect()).toBe(false);
    expect(store.isSolved()).toBe(false);
    expect(store.streak()).toBe(0);
    // The position is unchanged, so the solver can retry.
    expect(store.game().status).toBe('playing');
  });

  it('does not count a puzzle solved after an error as a clean solve', () => {
    store.loadPuzzle(PUZZLE);
    store.attemptMove('a7a6'); // wrong
    store.attemptMove('e7e5'); // right
    expect(store.isSolved()).toBe(true);
    expect(store.streak()).toBe(0);
    expect(store.solvedCount()).toBe(0);
  });
});
