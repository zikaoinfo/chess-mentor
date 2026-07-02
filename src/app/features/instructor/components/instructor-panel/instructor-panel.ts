import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  CoachingMessage,
  CoachingType,
  Difficulty,
  GameResult,
  InstructorMove,
  InstructorPhase,
} from '../../../../core/models/instructor.model';
import { MoveHistory } from '../move-history/move-history';
import { BOT_PRESETS, BotPersona } from '../../../../core/models/bot.model';

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

const RESULT_LABEL: Readonly<Record<GameResult, string>> = {
  'white-wins': 'Blanc gagne',
  'black-wins': 'Noir gagne',
  draw: 'Nulle',
};

/**
 * Side panel: difficulty picker, turn indicator, coaching bubble, game-over
 * banner, controls and the move history.
 */
@Component({
  selector: 'app-instructor-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoveHistory],
  templateUrl: './instructor-panel.html',
  styleUrl: './instructor-panel.scss',
})
export class InstructorPanel {
  readonly difficulty = input.required<Difficulty>();
  readonly phase = input.required<InstructorPhase>();
  readonly coaching = input<CoachingMessage | null>(null);
  readonly coachingLoading = input<boolean>(false);
  readonly gameResult = input<GameResult | null>(null);
  readonly moves = input<readonly InstructorMove[]>([]);
  readonly selectedBot = input<BotPersona | null>(null);

  readonly difficultyChange = output<Difficulty>();
  readonly botSelect = output<BotPersona | null>();
  readonly hint = output<void>();
  readonly newGame = output<void>();

  protected readonly bots = BOT_PRESETS;

  protected readonly options: readonly DifficultyOption[] = [
    { value: 'beginner', label: 'Débutant' },
    { value: 'easy', label: 'Facile' },
    { value: 'medium', label: 'Intermédiaire' },
  ];

  protected readonly canHint = computed(() => this.phase() === 'player-turn');
  protected readonly thinking = computed(() => this.phase() === 'bot-thinking');
  protected readonly gameOver = computed(() => this.phase() === 'game-over');

  protected readonly resultLabel = computed(() => {
    const result = this.gameResult();
    return result ? RESULT_LABEL[result] : 'Partie terminée';
  });

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
