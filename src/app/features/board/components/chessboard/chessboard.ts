import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { Orientation } from '../../../../core/models/game-state.model';
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

  readonly move = output<string>();

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

  protected glyph(piece: Piece | null): string {
    return piece ? GLYPHS[piece.type] : '';
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
    if (!this.interactive()) return;

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
