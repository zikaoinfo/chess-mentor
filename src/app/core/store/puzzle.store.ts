import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import {
  addEntity,
  entityConfig,
  setAllEntities,
  withEntities,
} from '@ngrx/signals/entities';
import { type } from '@ngrx/signals';

import { GameState } from '../models/game-state.model';
import { LichessPuzzle, PuzzleAttempt } from '../models/puzzle.model';
import { StorageService } from '../services/storage.service';
import { SoundService } from '../services/sound.service';
import { applySolverMove, setupPuzzle } from '../../features/board/utils/move-engine';

interface SessionState {
  readonly puzzle: LichessPuzzle | null;
  readonly game: GameState;
  /** Number of solver moves tried on the current puzzle (right or wrong). */
  readonly attemptsOnCurrent: number;
  /** Epoch ms when the current puzzle started — for timing the attempt. */
  readonly startedAt: number;
  /** Set once the solver plays a wrong move on the current puzzle. */
  readonly failedCurrent: boolean;
  /** `null` until a move is tried, then the correctness of the last move. */
  readonly lastMoveCorrect: boolean | null;
  /** Most recent move played on the board (UCI), highlighted for the solver. */
  readonly lastMove: string | null;
  readonly streak: number;
  readonly bestStreak: number;
}

const IDLE_GAME: GameState = {
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  orientation: 'white',
  solutionIndex: 1,
  status: 'idle',
};

const initialState: SessionState = {
  puzzle: null,
  game: IDLE_GAME,
  attemptsOnCurrent: 0,
  startedAt: 0,
  failedCurrent: false,
  lastMoveCorrect: null,
  lastMove: null,
  streak: 0,
  bestStreak: 0,
};

const attemptConfig = entityConfig({
  entity: type<PuzzleAttempt>(),
  collection: 'attempt',
  selectId: (a) => `${a.puzzleId}:${new Date(a.solvedAt).getTime()}`,
});

/**
 * Global session store. Owns the puzzle currently being solved, the live
 * board state, the solver's streak, and the persisted attempt log (entities).
 */
export const PuzzleStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withEntities(attemptConfig),
  withComputed(({ attemptEntities, game }) => ({
    solvedCount: computed(() => attemptEntities().filter((a) => a.correct).length),
    totalAttempts: computed(() => attemptEntities().length),
    accuracyPct: computed(() => {
      const all = attemptEntities();
      if (all.length === 0) return 0;
      return Math.round((all.filter((a) => a.correct).length / all.length) * 100);
    }),
    isSolved: computed(() => game().status === 'solved'),
  })),
  withMethods((store, storage = inject(StorageService), sound = inject(SoundService)) => {
    function recordAttempt(correct: boolean): void {
      const puzzle = store.puzzle();
      if (!puzzle) return;
      const attempt: PuzzleAttempt = {
        puzzleId: puzzle.id,
        solvedAt: new Date(),
        attempts: store.attemptsOnCurrent(),
        timeMs: Date.now() - store.startedAt(),
        correct,
      };
      patchState(store, addEntity(attempt, attemptConfig));
      void storage.saveAttempt(attempt);
    }

    return {
      /** Load attempt history from storage into the entity collection. */
      async hydrate(): Promise<void> {
        const items = await storage.allAttempts();
        patchState(store, setAllEntities(items, attemptConfig));
      },

      /** Begin solving a freshly fetched puzzle. */
      loadPuzzle(puzzle: LichessPuzzle): void {
        const setup = setupPuzzle(puzzle.fen, puzzle.solution);
        patchState(store, {
          puzzle,
          game: {
            fen: setup.fen,
            orientation: setup.orientation,
            solutionIndex: setup.solutionIndex,
            status: 'playing',
          },
          attemptsOnCurrent: 0,
          startedAt: Date.now(),
          failedCurrent: false,
          lastMoveCorrect: null,
          lastMove: puzzle.solution[0] ?? null,
        });
      },

      /** Try a solver move (UCI). Updates board, streak and feedback. */
      attemptMove(uci: string): void {
        const puzzle = store.puzzle();
        const game = store.game();
        if (!puzzle || game.status !== 'playing') return;

        const result = applySolverMove(game.fen, uci, puzzle.solution, game.solutionIndex);
        patchState(store, { attemptsOnCurrent: store.attemptsOnCurrent() + 1 });

        if (!result.correct) {
          patchState(store, {
            failedCurrent: true,
            lastMoveCorrect: false,
            streak: 0,
          });
          sound.error();
          return;
        }

        if (result.solved) {
          const clean = !store.failedCurrent();
          recordAttempt(clean);
          const streak = clean ? store.streak() + 1 : 0;
          patchState(store, {
            game: { ...game, fen: result.fen, solutionIndex: result.solutionIndex, status: 'solved' },
            lastMoveCorrect: true,
            lastMove: result.opponentMove ?? uci,
            streak,
            bestStreak: Math.max(store.bestStreak(), streak),
          });
          sound.success();
          return;
        }

        patchState(store, {
          game: { ...game, fen: result.fen, solutionIndex: result.solutionIndex },
          lastMoveCorrect: true,
          lastMove: result.opponentMove ?? uci,
        });
        sound.move();
      },
    };
  }),
);
