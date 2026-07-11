import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { isOffTheme, PuzzleService } from '../../../../core/services/puzzle.service';
import { PuzzleStore } from '../../../../core/store/puzzle.store';
import { PuzzleTheme } from '../../../../core/models/puzzle.model';
import { HintState } from '../../../../core/models/instructor.model';
import { Chessboard } from '../../../board/components/chessboard/chessboard';
import { PuzzleCard } from '../../components/puzzle-card/puzzle-card';
import { FeedbackPanel } from '../../components/feedback-panel/feedback-panel';
import { StreakBadge } from '../../../../shared/components/streak-badge/streak-badge';
import { ThemeLabelPipe } from '../../../../shared/pipes/theme-label.pipe';

const THEMES: readonly PuzzleTheme[] = ['mix', 'fork', 'pin', 'mateIn1', 'mateIn2'];

/** Main training page: board + puzzle metadata + feedback + theme controls. */
@Component({
  selector: 'app-puzzle-trainer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Chessboard, PuzzleCard, FeedbackPanel, StreakBadge, ThemeLabelPipe],
  templateUrl: './puzzle-trainer.html',
  styleUrl: './puzzle-trainer.scss',
})
export class PuzzleTrainer {
  private readonly store = inject(PuzzleStore);
  private readonly service = inject(PuzzleService);

  protected readonly puzzle = this.store.puzzle;
  protected readonly game = this.store.game;
  protected readonly streak = this.store.streak;
  protected readonly solvedCount = this.store.solvedCount;
  protected readonly lastMoveCorrect = this.store.lastMoveCorrect;
  protected readonly lastMove = this.store.lastMove;

  protected readonly isLoading = this.service.isLoading;
  protected readonly error = this.service.error;
  protected readonly activeTheme = this.service.theme;

  protected readonly themes = THEMES;
  protected readonly interactive = computed(() => this.game().status === 'playing');
  protected readonly hintUsed = this.store.hintUsed;

  /** Board hint: reveal only the origin square of the expected move. */
  protected readonly boardHint = computed<HintState | null>(() => {
    const square = this.store.hintSquare();
    return square ? { from: square, reason: '' } : null;
  });

  private lastLoadedId: string | null = null;
  private lastThemeSeen: PuzzleTheme | null = null;
  private themeSkips = 0;

  constructor() {
    // Bridge the async resource into the session store: whenever a new puzzle
    // resolves, seed the store. This is an imperative side-effect (not state
    // derivation), which is what effect() is for.
    effect(() => {
      const theme = this.service.theme();
      const fetched = this.service.puzzle();

      // Reset the mismatch budget whenever the requested theme changes.
      if (theme !== this.lastThemeSeen) {
        this.lastThemeSeen = theme;
        this.themeSkips = 0;
      }
      if (!fetched || fetched.id === this.lastLoadedId) return;

      // Safety net: should the feed ever hand back a puzzle off the requested
      // theme (e.g. a "Mat en 1" pick returning a material tactic), skip a few
      // times rather than show the wrong kind of puzzle. Bounded so a theme
      // with a sparse pool can't loop forever.
      if (isOffTheme(theme, fetched.themes) && this.themeSkips < 4) {
        this.themeSkips++;
        this.lastLoadedId = fetched.id;
        this.service.next();
        return;
      }

      this.lastLoadedId = fetched.id;
      this.store.loadPuzzle(fetched);
    });
    void this.store.hydrate();
  }

  protected onMove(uci: string): void {
    this.store.attemptMove(uci);
  }

  protected onNext(): void {
    this.service.next();
  }

  protected onHint(): void {
    this.store.requestHint();
  }

  protected onShowSolution(): void {
    void this.store.showSolution();
  }

  protected selectTheme(theme: PuzzleTheme): void {
    if (theme !== this.activeTheme()) {
      this.service.setTheme(theme);
    } else {
      this.service.next();
    }
  }
}
