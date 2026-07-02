import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';

import { RushService } from '../../../../core/services/rush.service';
import { StorageService } from '../../../../core/services/storage.service';
import { SoundService } from '../../../../core/services/sound.service';
import { LichessPuzzle } from '../../../../core/models/puzzle.model';
import { RushMode, RushScore } from '../../../../core/models/rush.model';
import { Chessboard } from '../../../board/components/chessboard/chessboard';
import { applySolverMove } from '../../../board/utils/move-engine';
import { fenTurn } from '../../../board/utils/fen.utils';
import { bestScore, durationFor, formatClock, solutionSan, targetDifficulty } from '../../utils/rush.utils';

type Screen = 'menu' | 'running' | 'ended';

/** A missed puzzle, kept for the end-of-run review. */
interface FailedPuzzle {
  readonly id: string;
  readonly fen: string;
  readonly san: readonly string[];
  readonly orientation: 'white' | 'black';
}

/**
 * Puzzle Rush: chain as many puzzles as possible in 3/5 minutes, or survive —
 * 3 strikes and it's over. Difficulty ramps up as the score grows; the best
 * score per mode is kept locally.
 */
@Component({
  selector: 'app-puzzle-rush',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Chessboard],
  templateUrl: './puzzle-rush.html',
  styleUrl: './puzzle-rush.scss',
})
export class PuzzleRush {
  private readonly service = inject(RushService);
  private readonly storage = inject(StorageService);
  private readonly sound = inject(SoundService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly screen = signal<Screen>('menu');
  protected readonly mode = signal<RushMode>('3min');
  protected readonly score = signal(0);
  protected readonly strikes = signal(0);
  protected readonly timeLeft = signal(0);
  protected readonly records = signal<readonly RushScore[]>([]);
  protected readonly failed = signal<readonly FailedPuzzle[]>([]);

  protected readonly fen = signal<string | null>(null);
  protected readonly solutionIndex = signal(0);
  protected readonly lastMove = signal<string | null>(null);
  private puzzle: LichessPuzzle | null = null;
  private lastLoadedId: string | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  protected readonly isLoading = this.service.isLoading;
  protected readonly clock = computed(() => formatClock(this.timeLeft()));
  protected readonly isSurvival = computed(() => this.mode() === 'survival');
  protected readonly orientation = computed(() => {
    const fen = this.fen();
    return fen && fenTurn(fen) === 'b' ? 'black' as const : 'white' as const;
  });
  protected readonly best = computed(() => bestScore(this.records(), this.mode()));

  protected readonly modes: readonly { value: RushMode; label: string; hint: string }[] = [
    { value: '3min', label: '3 minutes', hint: 'Le classique — vitesse pure.' },
    { value: '5min', label: '5 minutes', hint: 'Plus long, plus profond.' },
    { value: 'survival', label: 'Survie', hint: '3 erreurs et c’est fini.' },
  ];

  constructor() {
    void this.storage.allRushScores().then((s) => this.records.set(s));
    // Bridge the async puzzle feed into the run (imperative side-effect).
    effect(() => {
      const fetched = this.service.puzzle();
      if (fetched && fetched.id !== this.lastLoadedId && this.screen() === 'running') {
        this.lastLoadedId = fetched.id;
        this.puzzle = fetched;
        this.fen.set(fetched.fen);
        this.solutionIndex.set(0);
        this.lastMove.set(fetched.lastMove);
      }
    });
    this.destroyRef.onDestroy(() => this.stopClock());
  }

  protected start(mode: RushMode): void {
    this.mode.set(mode);
    this.score.set(0);
    this.strikes.set(0);
    this.failed.set([]);
    this.puzzle = null;
    this.fen.set(null);
    this.lastLoadedId = null;
    this.screen.set('running');
    this.service.setDifficulty('easiest');
    this.service.next();

    const duration = durationFor(mode);
    this.stopClock();
    if (duration !== null) {
      this.timeLeft.set(duration);
      this.intervalId = setInterval(() => {
        this.timeLeft.update((t) => t - 1);
        if (this.timeLeft() <= 0) this.end();
      }, 1000);
    }
  }

  protected onMove(uci: string): void {
    const puzzle = this.puzzle;
    const fen = this.fen();
    if (!puzzle || !fen || this.screen() !== 'running') return;

    const result = applySolverMove(fen, uci, puzzle.solution, this.solutionIndex());
    if (!result.correct) {
      this.sound.error();
      this.strikes.update((s) => s + 1);
      this.failed.set([
        ...this.failed(),
        {
          id: puzzle.id,
          fen: puzzle.fen,
          san: solutionSan(puzzle.fen, puzzle.solution),
          orientation: fenTurn(puzzle.fen) === 'b' ? 'black' : 'white',
        },
      ]);
      if (this.isSurvival() && this.strikes() >= 3) {
        this.end();
        return;
      }
      this.nextPuzzle();
      return;
    }

    if (result.solved) {
      this.sound.success();
      this.score.update((s) => s + 1);
      this.service.setDifficulty(targetDifficulty(this.score()));
      this.nextPuzzle();
      return;
    }

    this.sound.move();
    this.fen.set(result.fen);
    this.solutionIndex.set(result.solutionIndex);
    this.lastMove.set(result.opponentMove ?? uci);
  }

  private nextPuzzle(): void {
    this.puzzle = null;
    this.fen.set(null);
    this.service.next();
  }

  protected end(): void {
    if (this.screen() !== 'running') return;
    this.stopClock();
    this.screen.set('ended');
    this.sound.gameOver();
    const record: RushScore = { mode: this.mode(), score: this.score(), at: new Date() };
    this.records.set([...this.records(), record]);
    void this.storage.addRushScore(record);
  }

  protected backToMenu(): void {
    this.stopClock();
    this.screen.set('menu');
  }

  private stopClock(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
