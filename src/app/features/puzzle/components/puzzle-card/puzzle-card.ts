import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Orientation } from '../../../../core/models/game-state.model';
import { LichessPuzzle } from '../../../../core/models/puzzle.model';
import { ThemeLabelPipe } from '../../../../shared/pipes/theme-label.pipe';

/** Summary card for the puzzle currently being solved. */
@Component({
  selector: 'app-puzzle-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ThemeLabelPipe],
  templateUrl: './puzzle-card.html',
  styleUrl: './puzzle-card.scss',
})
export class PuzzleCard {
  readonly puzzle = input.required<LichessPuzzle>();
  readonly orientation = input.required<Orientation>();

  protected readonly toMove = computed(() =>
    this.orientation() === 'white' ? 'Les blancs jouent' : 'Les noirs jouent',
  );

  /** Show at most the first few themes to keep the card tidy. */
  protected readonly shownThemes = computed(() => this.puzzle().themes.slice(0, 4));
}
