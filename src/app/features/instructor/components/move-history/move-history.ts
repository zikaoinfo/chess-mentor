import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { InstructorMove } from '../../../../core/models/instructor.model';

interface MoveRow {
  readonly n: number;
  readonly white: InstructorMove | null;
  readonly black: InstructorMove | null;
}

/**
 * Read-only move list in two columns (white / black), SAN, grouped per full
 * move: `1. e4  e5`. Auto-scrolls to the latest move. No navigation — the
 * board always shows the live position.
 */
@Component({
  selector: 'app-move-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './move-history.html',
  styleUrl: './move-history.scss',
})
export class MoveHistory {
  readonly moves = input.required<readonly InstructorMove[]>();

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  /** Moves grouped by full move (chess always starts with White). */
  protected readonly rows = computed<readonly MoveRow[]>(() => {
    const all = this.moves();
    const rows: MoveRow[] = [];
    for (let i = 0; i < all.length; i += 2) {
      rows.push({ n: i / 2 + 1, white: all[i] ?? null, black: all[i + 1] ?? null });
    }
    return rows;
  });

  constructor() {
    // Keep the latest move visible. DOM side effect (not state derivation),
    // re-runs after render whenever `rows` changes.
    afterRenderEffect(() => {
      this.rows();
      const el = this.list()?.nativeElement;
      // Scroll ONLY this container — scrollIntoView also scrolls every
      // scrollable ancestor, which on mobile yanked the whole page down to
      // the history after each move (and ghost taps then landed on whatever
      // slid under the finger, e.g. the bot carousel → game reset).
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
