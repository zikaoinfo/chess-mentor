import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
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

/** Squares are 12.5 viewBox units; a drag shorter than this is still a tap. */
const DRAG_THRESHOLD = 1.2;

interface DragState {
  readonly from: string;
  readonly piece: Piece;
  readonly x: number;
  readonly y: number;
  /** True once the pointer travelled past DRAG_THRESHOLD — it's a real drag. */
  readonly moved: boolean;
}

/**
 * Interactive chessboard rendered as pure inline SVG — no external board
 * library. The FEN input is the single source of truth; moves are emitted as
 * UCI strings. Interaction goes through Pointer Events so mouse, touch and
 * pen behave identically: tap-to-select then tap-to-target, or a direct drag
 * of the piece. Keyboard (Enter/Space per square) stays available; chess.js
 * supplies the legal-move hints.
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
  /** Square of the king currently in check, highlighted in red. */
  readonly checkSquare = input<string | null>(null);

  readonly move = output<string>();

  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('boardSvg');

  /** Effective interactivity — disabled while the bot is to move. */
  protected readonly active = computed(() => this.interactive() && !this.lockedForBot());

  /** Selected source square; auto-clears whenever the position changes. */
  protected readonly selected = linkedSignal<string, string | null>({
    source: this.fen,
    computation: () => null,
  });

  /** In-flight pointer drag; null when idle. */
  protected readonly drag = signal<DragState | null>(null);

  /** The piece following the pointer — only once the gesture is a real drag. */
  protected readonly dragPiece = computed<DragState | null>(() => {
    const d = this.drag();
    return d?.moved ? d : null;
  });

  /** Square currently under the dragged piece, for the drop-target outline. */
  protected readonly dropSquare = computed<string | null>(() => {
    const d = this.dragPiece();
    return d ? this.squareAt(d.x, d.y) : null;
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

  /** Pointer position converted into 0–100 viewBox coordinates. */
  private toBoardPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.svgRef().nativeElement.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  }

  /** Square name at a viewBox point, respecting orientation; null if outside. */
  private squareAt(x: number, y: number): string | null {
    const col = Math.floor(x / 12.5);
    const row = Math.floor(y / 12.5);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    const file = this.orientation() === 'white' ? col : 7 - col;
    const rank = this.orientation() === 'white' ? 7 - row : row;
    return String.fromCharCode(97 + file) + (rank + 1);
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

  /** Origin piece is ghosted while its double follows the pointer. */
  protected isDragSource(name: string): boolean {
    return this.dragPiece()?.from === name;
  }

  protected isDropTarget(name: string): boolean {
    return this.dropSquare() === name;
  }

  /** Select / play a square — shared by keyboard activation and taps. */
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

  protected onPointerDown(event: PointerEvent, square: BoardSquare): void {
    if (!this.active()) return;
    // Stops scrolling/text-selection kicking in mid-gesture on touch devices.
    event.preventDefault();

    const from = this.selected();
    if (from && this.legal().has(square.name)) {
      this.move.emit(`${from}${square.name}`);
      this.selected.set(null);
      return;
    }

    if (square.piece && square.piece.color === this.turn()) {
      this.selected.set(square.name);
      const point = this.toBoardPoint(event);
      this.drag.set({ from: square.name, piece: square.piece, ...point, moved: false });
      this.svgRef().nativeElement.setPointerCapture(event.pointerId);
    } else {
      this.selected.set(null);
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    const d = this.drag();
    if (!d) return;
    const point = this.toBoardPoint(event);
    // x/y hold the press origin until the threshold is crossed, so the
    // distance is always measured from where the gesture started.
    if (!d.moved && Math.hypot(point.x - d.x, point.y - d.y) <= DRAG_THRESHOLD) return;
    this.drag.set({ ...d, x: point.x, y: point.y, moved: true });
  }

  protected onPointerUp(event: PointerEvent): void {
    const d = this.drag();
    if (!d) return;
    this.drag.set(null);
    // A press without movement is a tap: the piece stays selected and the
    // next tap on a legal square (handled in onPointerDown) plays the move.
    if (!d.moved) return;

    const point = this.toBoardPoint(event);
    const target = this.squareAt(point.x, point.y);
    if (target && target !== d.from && this.legal().has(target)) {
      this.move.emit(`${d.from}${target}`);
      this.selected.set(null);
    } else if (target !== d.from) {
      // Dropped on an illegal square or off the board: cancel the selection.
      this.selected.set(null);
    }
  }

  protected onPointerCancel(): void {
    this.drag.set(null);
  }
}
