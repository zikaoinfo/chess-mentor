import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const GLYPHS: Readonly<Record<string, string>> = {
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};

/**
 * Chess.com-style capture row for one player: the pieces they took, plus a
 * "+N" badge when they lead on material. `capturedColor` is the colour of
 * the VICTIM pieces (what this player captured), so glyphs read naturally.
 */
@Component({
  selector: 'app-capture-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar" [attr.aria-label]="'Pièces capturées par ' + label()">
      <span class="bar__label">{{ label() }}</span>
      <span class="bar__pieces">
        @for (piece of pieces(); track $index) {
          <span
            class="bar__piece"
            [class.bar__piece--white]="capturedColor() === 'w'"
            [class.bar__piece--black]="capturedColor() === 'b'"
          >{{ glyph(piece) }}</span>
        } @empty {
          <span class="bar__none" aria-hidden="true">—</span>
        }
      </span>
      @if (advantage() > 0) {
        <span class="bar__adv">+{{ advantage() }}</span>
      }
    </div>
  `,
  styleUrl: './capture-bar.scss',
})
export class CaptureBar {
  readonly label = input.required<string>();
  /** Types ('p'|'n'|'b'|'r'|'q') of the pieces this player captured. */
  readonly pieces = input.required<readonly string[]>();
  /** Colour of the captured pieces (the opponent's colour). */
  readonly capturedColor = input.required<'w' | 'b'>();
  /** Material lead in points; rendered only when positive. */
  readonly advantage = input<number>(0);

  protected readonly hasContent = computed(() => this.pieces().length > 0 || this.advantage() > 0);

  protected glyph(piece: string): string {
    // U+FE0E: force monochrome text rendering (same fix as the board pieces).
    return (GLYPHS[piece] ?? '') + '\uFE0E';
  }
}
