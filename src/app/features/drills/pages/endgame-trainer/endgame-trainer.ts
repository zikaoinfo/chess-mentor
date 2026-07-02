import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Chess } from 'chess.js';

import { DRILLS } from '../../data/endgames';
import { DrillProgress, EndgameDrill } from '../../../../core/models/drill.model';
import { InstructorService, fallbackMove } from '../../../../core/services/instructor.service';
import { StorageService } from '../../../../core/services/storage.service';
import { SoundService } from '../../../../core/services/sound.service';
import { Chessboard } from '../../../board/components/chessboard/chessboard';

type DrillStatus = 'playing' | 'won' | 'failed';

interface CategoryGroup {
  readonly category: string;
  readonly drills: readonly EndgameDrill[];
  readonly done: number;
}

/**
 * Endgame drills: classic winning positions (Q+K, R+K, king opposition).
 * The player must convert; Stockfish defends at full strength. Feedback
 * warns when the win slips away; progress is saved per drill.
 */
@Component({
  selector: 'app-endgame-trainer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Chessboard],
  templateUrl: './endgame-trainer.html',
  styleUrl: './endgame-trainer.scss',
})
export class EndgameTrainer {
  private readonly instructor = inject(InstructorService);
  private readonly storage = inject(StorageService);
  private readonly sound = inject(SoundService);

  protected readonly progress = signal<readonly DrillProgress[]>([]);
  protected readonly drill = signal<EndgameDrill | null>(null);
  protected readonly fen = signal('');
  protected readonly lastMove = signal<string | null>(null);
  protected readonly status = signal<DrillStatus>('playing');
  protected readonly botThinking = signal(false);
  protected readonly feedback = signal<string | null>(null);

  protected readonly groups = computed<readonly CategoryGroup[]>(() => {
    const done = new Set(this.progress().map((p) => p.id));
    const categories = [...new Set(DRILLS.map((d) => d.category))];
    return categories.map((category) => {
      const drills = DRILLS.filter((d) => d.category === category);
      return { category, drills, done: drills.filter((d) => done.has(d.id)).length };
    });
  });

  protected readonly interactive = computed(
    () => this.status() === 'playing' && !this.botThinking(),
  );

  constructor() {
    void this.storage.allDrills().then((p) => this.progress.set(p));
  }

  protected isDone(id: string): boolean {
    return this.progress().some((p) => p.id === id);
  }

  protected start(drill: EndgameDrill): void {
    this.drill.set(drill);
    this.fen.set(drill.fen);
    this.lastMove.set(null);
    this.status.set('playing');
    this.feedback.set(drill.goal === 'mate' ? 'À toi de mater !' : 'Amène ton pion à promotion !');
  }

  protected backToList(): void {
    this.drill.set(null);
  }

  protected retry(): void {
    const drill = this.drill();
    if (drill) this.start(drill);
  }

  protected async onMove(uci: string): Promise<void> {
    const drill = this.drill();
    if (!drill || !this.interactive()) return;

    const chess = new Chess(this.fen());
    let move;
    try {
      move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : 'q',
      });
    } catch {
      return;
    }
    this.fen.set(chess.fen());
    this.lastMove.set(move.lan);

    if (chess.isCheckmate()) {
      this.win(drill);
      return;
    }
    if (drill.goal === 'promote' && move.promotion) {
      this.win(drill);
      return;
    }
    if (chess.isGameOver()) {
      this.fail('Pat ou nulle… la victoire s’est envolée. Réessaie !');
      return;
    }

    // Stockfish defends at full strength; the same search feeds the coaching.
    this.botThinking.set(true);
    try {
      const evaluation = await this.instructor.evaluate(chess.fen(), 12);
      // Perspective: Black to move — negate for White.
      const whiteMate = evaluation.mate !== null ? -evaluation.mate : null;
      const whiteCp = evaluation.cp !== null ? -evaluation.cp : null;
      if (whiteMate !== null && whiteMate > 0) {
        this.feedback.set(`Mat en ${whiteMate} — continue !`);
      } else if (whiteCp !== null && whiteCp < 200) {
        this.feedback.set('⚠️ Tu t’éloignes de la victoire (le gain se réduit).');
      } else {
        this.feedback.set(null);
      }

      const defense = evaluation.uci ?? fallbackMove(chess.fen());
      if (!defense) {
        // Defender has no move: mate was handled above, so it's stalemate.
        this.fail('Pat ! La partie est nulle. Réessaie.');
        return;
      }
      try {
        const reply = chess.move({
          from: defense.slice(0, 2),
          to: defense.slice(2, 4),
          promotion: defense.length > 4 ? defense[4] : 'q',
        });
        this.fen.set(chess.fen());
        this.lastMove.set(reply.lan);
        this.sound.move();
      } catch {
        this.fail('Position bloquée — réessaie.');
        return;
      }
      if (chess.isGameOver()) {
        if (chess.isCheckmate()) this.fail('Tu t’es fait mater ?! Réessaie.');
        else this.fail('Pat ou nulle… Réessaie.');
      }
    } finally {
      this.botThinking.set(false);
    }
  }

  private win(drill: EndgameDrill): void {
    this.status.set('won');
    this.feedback.set(drill.goal === 'mate' ? '🏆 Échec et mat !' : '🏆 Promotion ! Drill réussi.');
    this.sound.success();
    if (!this.isDone(drill.id)) {
      const record: DrillProgress = {
        id: drill.id,
        category: drill.category,
        completedAt: new Date(),
      };
      this.progress.set([...this.progress(), record]);
      void this.storage.markDrill(record);
    }
  }

  private fail(message: string): void {
    this.status.set('failed');
    this.feedback.set(message);
    this.sound.error();
  }
}
