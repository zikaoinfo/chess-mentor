import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { InstructorStore } from './instructor.store';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('InstructorStore', () => {
  let store: InstanceType<typeof InstructorStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    store = TestBed.inject(InstructorStore);
  });

  it('starts a new game with the player to move', () => {
    store.newGame('beginner', 'white');
    expect(store.phase()).toBe('player-turn');
    expect(store.currentFen()).toBe(START_FEN);
    expect(store.moveHistory()).toEqual([]);
    expect(store.hint()).toBeNull();
    expect(store.isPlayerTurn()).toBe(true);
  });

  it('accepts a legal player move and hands the turn to the bot', () => {
    store.newGame('beginner', 'white');
    const ok = store.playerMove('e2e4');
    expect(ok).toBe(true);
    expect(store.phase()).toBe('bot-thinking');
    expect(store.moveHistory().at(-1)).toMatchObject({ san: 'e4', by: 'player' });
    expect(store.currentFen()).not.toBe(START_FEN);
  });

  it('rejects an illegal move and stays on the player turn', () => {
    store.newGame('beginner', 'white');
    const ok = store.playerMove('e2e5'); // illegal pawn jump
    expect(ok).toBe(false);
    expect(store.phase()).toBe('player-turn');
    expect(store.moveHistory()).toEqual([]);
  });

  it('ignores moves when it is not the player turn', () => {
    store.newGame('beginner', 'white');
    store.playerMove('e2e4'); // → bot-thinking
    expect(store.playerMove('d2d4')).toBe(false);
  });
});
