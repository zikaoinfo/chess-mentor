import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { Orientation } from '../../../../core/models/game-state.model';
import { HintState } from '../../../../core/models/instructor.model';
import { BoardSquare, fenToBoard, fenTurn, Piece } from '../../utils/fen.utils';
import { legalTargets } from '../../utils/move-engine';

const GLYPHS: Readonly<Record<string, string>> = {
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};

/**
 * Interactive chessboard rendered as pure inline SVG — no external board
 * library. The FEN input is the single source of truth; moves are emitted as
 * UCI strings. Interaction is click-to-select then click-to-target, which is
 * accessible and testable; chess.js supplies the legal-move hints.
 */
@Component({
  selector: 'app-chessboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chessboard.html',
  styleUrl: './chessboard.scss',
})
export class Chessboard {
  readonly fen = input.required<string>();
  readonly orientation = input<Orientation>('white');
  readonly interactive = input<boolean>(true);
  /** Last move played, UCI, highlighted on the board. */
  readonly lastMove = input<string | null>(null);
  /** Coaching hint to surface (origin/target highlight + arrow). */
  readonly hintState = input<HintState | null>(null);
  /** When true the board is locked while the bot is thinking. */
  readonly lockedForBot = input<boolean>(false);

  readonly move = output<string>();

  /** Effective interactivity — disabled while the bot is to move. */
  protected readonly active = computed(() => this.interactive() && !this.lockedForBot());

  /** Selected source square; auto-clears whenever the position changes. */
  protected readonly selected = linkedSignal<string, string | null>({
    source: this.fen,
    computation: () => null,
  });

  protected readonly board = computed<readonly BoardSquare[]>(() => {
    const squares = fenToBoard(this.fen());
    return this.orientation() === 'black' ? [...squares].reverse() : squares;
  });

  private readonly turn = computed(() => fenTurn(this.fen()));

  protected readonly legal = computed<ReadonlySet<string>>(() => {
    const from = this.selected();
    return from ? new Set(legalTargets(this.fen(), from)) : new Set<string>();
  });

  private readonly lastSquares = computed<ReadonlySet<string>>(() => {
    const uci = this.lastMove();
    return uci ? new Set([uci.slice(0, 2), uci.slice(2, 4)]) : new Set<string>();
  });

  /** Centre (in the 0–100 board viewBox) of a square, respecting orientation. */
  private squareCenter(name: string): { x: number; y: number } {
    const file = name.charCodeAt(0) - 97; // a=0 … h=7
    const rank = Number(name[1]) - 1; // 1=0 … 8=7
    const col = this.orientation() === 'white' ? file : 7 - file;
    const row = this.orientation() === 'white' ? 7 - rank : rank;
    return { x: col * 12.5 + 6.25, y: row * 12.5 + 6.25 };
  }

  /** Geometry of the hint arrow, or null when no hint (or no target) is set. */
  protected readonly hintArrow = computed<{ x1: number; y1: number; x2: number; y2: number } | null>(() => {
    const hint = this.hintState();
    if (!hint?.to) return null;
    const a = this.squareCenter(hint.from);
    const b = this.squareCenter(hint.to);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });

  protected glyph(piece: Piece | null): string {
    // Append U+FE0E (text variation selector): without it, iOS/some browsers
    // render ♟ (U+265F) as a colour emoji — black-coloured and oversized,
    // ignoring `fill` and `font-size`. FE0E forces monochrome text rendering so
    // the gradient fill and size apply to every piece consistently.
    return piece ? GLYPHS[piece.type] + '\uFE0E' : '';
  }

  protected isHintFrom(name: string): boolean {
    return this.hintState()?.from === name;
  }

  protected isHintTo(name: string): boolean {
    return this.hintState()?.to === name;
  }

  protected isSelected(name: string): boolean {
    return this.selected() === name;
  }

  protected isLegal(name: string): boolean {
    return this.legal().has(name);
  }

  protected isLast(name: string): boolean {
    return this.lastSquares().has(name);
  }

  protected onSquare(square: BoardSquare): void {
    if (!this.active()) return;

    const from = this.selected();
    if (from && this.legal().has(square.name)) {
      this.move.emit(`${from}${square.name}`);
      this.selected.set(null);
      return;
    }

    if (square.piece && square.piece.color === this.turn()) {
      this.selected.set(square.name);
    } else {
      this.selected.set(null);
    }
  }
}
