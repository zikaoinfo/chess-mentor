import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { InstructorStore } from '../../../../core/store/instructor.store';
import { Difficulty } from '../../../../core/models/instructor.model';
import { BotPersona } from '../../../../core/models/bot.model';
import { Chessboard } from '../../../board/components/chessboard/chessboard';
import { InstructorPanel } from '../../components/instructor-panel/instructor-panel';
import { HintOverlay } from '../../components/hint-overlay/hint-overlay';
import { fenTurn, kingSquare } from '../../../board/utils/fen.utils';

/** "Play the bot" page: board + coaching panel, driven by the InstructorStore. */
@Component({
  selector: 'app-instructor-game',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Chessboard, InstructorPanel, HintOverlay],
  templateUrl: './instructor-game.html',
  styleUrl: './instructor-game.scss',
})
export class InstructorGame {
  private readonly store = inject(InstructorStore);

  protected readonly fen = this.store.currentFen;
  protected readonly phase = this.store.phase;
  protected readonly difficulty = this.store.difficulty;
  protected readonly coaching = this.store.coaching;
  protected readonly hint = this.store.hint;
  protected readonly playerColor = this.store.playerColor;
  protected readonly lastMove = this.store.lastMove;
  protected readonly isPlayerTurn = this.store.isPlayerTurn;
  protected readonly isThinking = this.store.isThinking;
  protected readonly gameResult = this.store.gameResult;
  protected readonly moveHistory = this.store.moveHistory;
  protected readonly coachingLoading = this.store.coachingLoading;
  protected readonly bot = this.store.bot;

  /** Square of the checked king (the side to move), or null. */
  protected readonly checkSquare = computed(() => {
    if (!this.store.inCheck()) return null;
    const fen = this.fen();
    return kingSquare(fen, fenTurn(fen));
  });

  constructor() {
    this.store.newGame('beginner');
  }

  protected onMove(uci: string): void {
    this.store.playerMove(uci);
  }

  protected onHint(): void {
    void this.store.requestHint();
  }

  protected onUndo(): void {
    this.store.undoMove();
  }

  /** A restart mid-game silently discards it — ask first. */
  private confirmAbandon(): boolean {
    const inProgress = this.moveHistory().length > 0 && this.gameResult() === null;
    return !inProgress || globalThis.confirm('Abandonner la partie en cours ?');
  }

  protected onDismissHint(): void {
    this.store.clearHint();
  }

  protected onNewGame(): void {
    if (!this.confirmAbandon()) return;
    this.store.newGame(this.difficulty(), this.playerColor(), this.bot());
  }

  protected onSelectBot(bot: BotPersona | null): void {
    if (bot?.id === this.bot()?.id || !this.confirmAbandon()) return;
    this.store.newGame(this.difficulty(), this.playerColor(), bot);
  }

  protected onSelectColor(color: 'white' | 'black'): void {
    if (color === this.playerColor() || !this.confirmAbandon()) return;
    this.store.newGame(this.difficulty(), color, this.bot());
  }

  protected onDifficulty(difficulty: Difficulty): void {
    this.store.setDifficulty(difficulty);
  }
}
