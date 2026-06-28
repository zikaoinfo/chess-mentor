import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  CoachingMessage,
  CoachingType,
  Difficulty,
  InstructorPhase,
} from '../../../../core/models/instructor.model';

interface DifficultyOption {
  readonly value: Difficulty;
  readonly label: string;
}

const COACH_ICON: Readonly<Record<CoachingType, string>> = {
  praise: '🎉',
  warning: '⚠️',
  tip: '💡',
  explanation: '🤖',
};

/** Side panel: difficulty picker, turn indicator, coaching bubble, controls. */
@Component({
  selector: 'app-instructor-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './instructor-panel.html',
  styleUrl: './instructor-panel.scss',
})
export class InstructorPanel {
  readonly difficulty = input.required<Difficulty>();
  readonly phase = input.required<InstructorPhase>();
  readonly coaching = input<CoachingMessage | null>(null);

  readonly difficultyChange = output<Difficulty>();
  readonly hint = output<void>();
  readonly newGame = output<void>();

  protected readonly options: readonly DifficultyOption[] = [
    { value: 'beginner', label: 'Débutant' },
    { value: 'easy', label: 'Facile' },
    { value: 'medium', label: 'Intermédiaire' },
  ];

  protected readonly canHint = computed(() => this.phase() === 'player-turn');
  protected readonly thinking = computed(() => this.phase() === 'bot-thinking');

  protected readonly turnLabel = computed(() => {
    switch (this.phase()) {
      case 'player-turn':
        return 'À toi de jouer';
      case 'bot-thinking':
        return 'Le bot réfléchit…';
      case 'game-over':
        return 'Partie terminée';
      default:
        return 'Prêt à jouer';
    }
  });

  protected coachIcon(type: CoachingType): string {
    return COACH_ICON[type];
  }
}
