import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StorageService } from '../../../../core/services/storage.service';
import { PuzzleAttempt } from '../../../../core/models/puzzle.model';
import { SavedGame } from '../../../../core/models/saved-game.model';
import { GamePhase } from '../../../../core/models/analysis.model';
import { ThemeLabelPipe } from '../../../../shared/pipes/theme-label.pipe';
import {
  accuracySeries,
  failedThemes,
  puzzleAccuracyPct,
  ratingSeries,
  toPolyline,
  weakestPhase,
  winrate,
} from '../../utils/insights.utils';

const PHASE_LABEL: Readonly<Record<GamePhase, string>> = {
  opening: "l'ouverture",
  middlegame: 'le milieu de jeu',
  endgame: 'la finale',
};

/** Insights dashboard: winrate, précision, faiblesses, évolution. */
@Component({
  selector: 'app-insights',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ThemeLabelPipe, RouterLink],
  templateUrl: './insights.html',
  styleUrl: './insights.scss',
})
export class Insights {
  private readonly storage = inject(StorageService);

  private readonly attempts = signal<readonly PuzzleAttempt[]>([]);
  private readonly games = signal<readonly SavedGame[]>([]);

  protected readonly winrateStats = computed(() => winrate(this.games()));
  protected readonly accuracy = computed(() => puzzleAccuracyPct(this.attempts()));
  protected readonly totalPuzzles = computed(() => this.attempts().length);
  protected readonly themes = computed(() => failedThemes(this.attempts()));
  protected readonly weakness = computed(() => weakestPhase(this.games()));

  protected readonly ratingPoints = computed(() => ratingSeries(this.attempts()));
  protected readonly ratingLine = computed(() => toPolyline(this.ratingPoints(), 100, 30));
  protected readonly ratingLast = computed(() => this.ratingPoints().at(-1)?.y ?? null);

  protected readonly accuracyPoints = computed(() => accuracySeries(this.attempts()));
  protected readonly accuracyLine = computed(() => toPolyline(this.accuracyPoints(), 100, 30));

  protected readonly weaknessLabel = computed(() => {
    const w = this.weakness();
    return w ? PHASE_LABEL[w.phase] : null;
  });

  constructor() {
    void this.storage.allAttempts().then((a) => this.attempts.set(a));
    void this.storage.allGames().then((g) => this.games.set(g));
  }
}
