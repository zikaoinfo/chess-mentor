import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HintState } from '../../../../core/models/instructor.model';

/**
 * Floating hint card shown over the board. The animated arrow + square
 * highlights live inside the chessboard SVG (driven by the same `hintState`);
 * this overlay carries the natural-language explanation of the hinted move.
 */
@Component({
  selector: 'app-hint-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hint(); as h) {
      <div class="overlay" role="status" aria-live="polite">
        <span class="overlay__icon" aria-hidden="true">💡</span>
        <div class="overlay__body">
          <p class="overlay__reason">{{ h.reason }}</p>
          <span class="overlay__move">{{ h.from }} → {{ h.to }}</span>
        </div>
      </div>
    }
  `,
  styleUrl: './hint-overlay.scss',
})
export class HintOverlay {
  readonly hint = input<HintState | null>(null);

  protected readonly visible = computed(() => this.hint() !== null);
}
