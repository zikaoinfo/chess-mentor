import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PuzzleStatus } from '../../../../core/models/game-state.model';

type Tone = 'neutral' | 'good' | 'bad';

/** ✓ / ✗ feedback with a short explanation and a "next puzzle" action. */
@Component({
  selector: 'app-feedback-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feedback-panel.html',
  styleUrl: './feedback-panel.scss',
})
export class FeedbackPanel {
  readonly status = input.required<PuzzleStatus>();
  /** Correctness of the most recent move (`null` before the first move). */
  readonly lastMoveCorrect = input<boolean | null>(null);

  readonly next = output<void>();

  protected readonly tone = computed<Tone>(() => {
    if (this.status() === 'solved') return 'good';
    if (this.status() === 'solution-shown') return 'neutral';
    if (this.lastMoveCorrect() === false) return 'bad';
    if (this.lastMoveCorrect() === true) return 'good';
    return 'neutral';
  });

  protected readonly icon = computed(() => {
    switch (this.tone()) {
      case 'good':
        return '✓';
      case 'bad':
        return '✗';
      default:
        return '♟';
    }
  });

  protected readonly message = computed(() => {
    if (this.status() === 'solved') return 'Puzzle résolu — bien joué !';
    if (this.status() === 'solution-shown') return 'Voici la solution complète.';
    if (this.lastMoveCorrect() === false) return 'Pas le bon coup. Réessayez.';
    if (this.lastMoveCorrect() === true) return 'Bon coup ! Continuez la combinaison.';
    return 'À vous de jouer : trouvez le meilleur coup.';
  });
}
