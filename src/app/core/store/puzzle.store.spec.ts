import { TestBed } from '@angular/core/testing';
import { PuzzleStore } from './puzzle.store';
import { LichessPuzzle } from '../models/puzzle.model';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// Position after 1.e4 e5 — White (the solver) to move.
const AFTER_E4_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';

// Lichess API convention: the solver plays solution[0]; odd indices are
// the opponent's scripted replies.
const PUZZLE: LichessPuzzle = {
  id: 'test1',
  rating: 1500,
  themes: ['opening'],
  solution: ['g1f3', 'b8c6', 'f1c4'],
  fen: AFTER_E4_E5,
  lastMove: 'e7e5',
};

describe('PuzzleStore', () => {
  let store: InstanceType<typeof PuzzleStore>;

  beforeEach(() => {
    store = TestBed.inject(PuzzleStore);
  });

  it('loads a puzzle at the API position — the solver moves first', () => {
    store.loadPuzzle(PUZZLE);
    expect(store.game().status).toBe('playing');
    expect(store.game().fen).toBe(AFTER_E4_E5);
    expect(store.game().solutionIndex).toBe(0);
    expect(store.game().orientation).toBe('white'); // white to move in the FEN
    expect(store.lastMove()).toBe('e7e5'); // opponent's blunder highlighted
  });

  it('accepts solution[0] and auto-plays the opponent reply', () => {
    store.loadPuzzle(PUZZLE);
    store.attemptMove('g1f3');
    expect(store.lastMoveCorrect()).toBe(true);
    expect(store.game().solutionIndex).toBe(2); // player move + auto reply
    expect(store.lastMove()).toBe('b8c6');
    expect(store.game().status).toBe('playing');
  });

  it('solves the puzzle on the final move and grows the streak', () => {
    store.loadPuzzle(PUZZLE);
    store.attemptMove('g1f3');
    store.attemptMove('f1c4');
    expect(store.isSolved()).toBe(true);
    expect(store.solvedCount()).toBe(1);
    expect(store.streak()).toBe(1);
  });

  it('rejects a wrong move without changing the position', () => {
    store.loadPuzzle(PUZZLE);
    store.attemptMove('d2d4'); // legal but not the solution
    expect(store.lastMoveCorrect()).toBe(false);
    expect(store.game().fen).toBe(AFTER_E4_E5);
    expect(store.streak()).toBe(0);
    expect(store.game().status).toBe('playing');
  });

  it('does not count a puzzle solved after an error as a clean solve', () => {
    store.loadPuzzle(PUZZLE);
    store.attemptMove('d2d4'); // wrong
    store.attemptMove('g1f3'); // right
    store.attemptMove('f1c4'); // right — solved
    expect(store.isSolved()).toBe(true);
    expect(store.streak()).toBe(0);
    expect(store.solvedCount()).toBe(0);
  });

  it('reveals only the origin square on hint, once per puzzle', () => {
    store.loadPuzzle(PUZZLE);
    store.requestHint();
    expect(store.hintSquare()).toBe('g1');
    expect(store.hintUsed()).toBe(true);

    // Hint clears on the next correct move and cannot be used again.
    store.attemptMove('g1f3');
    expect(store.hintSquare()).toBeNull();
    store.requestHint();
    expect(store.hintSquare()).toBeNull();
  });

  it('shows the full solution and records the attempt as failed', async () => {
    store.loadPuzzle(PUZZLE);
    const before = store.totalAttempts();
    await store.showSolution();
    expect(store.game().status).toBe('solution-shown');
    expect(store.game().solutionIndex).toBe(PUZZLE.solution.length);
    expect(store.game().fen).not.toBe(AFTER_E4_E5);
    expect(store.lastMove()).toBe('f1c4');
    expect(store.totalAttempts()).toBe(before + 1);
    expect(store.streak()).toBe(0);
  });

  it('starts from the standard position only via a puzzle FEN', () => {
    // Sanity: the store never mutates the provided FEN on load.
    store.loadPuzzle({ ...PUZZLE, fen: START_FEN, lastMove: null, solution: ['e2e4'] });
    expect(store.game().fen).toBe(START_FEN);
    expect(store.lastMove()).toBeNull();
  });
});
