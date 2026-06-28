import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { InstructorStore } from '../../../../core/store/instructor.store';
import { Difficulty } from '../../../../core/models/instructor.model';
import { Chessboard } from '../../../board/components/chessboard/chessboard';
import { InstructorPanel } from '../../components/instructor-panel/instructor-panel';
import { HintOverlay } from '../../components/hint-overlay/hint-overlay';

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

  constructor() {
    this.store.newGame('beginner');
  }

  protected onMove(uci: string): void {
    this.store.playerMove(uci);
  }

  protected onHint(): void {
    void this.store.requestHint();
  }

  protected onNewGame(): void {
    this.store.newGame(this.difficulty());
  }

  protected onDifficulty(difficulty: Difficulty): void {
    this.store.setDifficulty(difficulty);
  }
}
