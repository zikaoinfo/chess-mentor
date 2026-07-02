import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Chess } from 'chess.js';

import { OpeningsService } from '../../../../core/services/openings.service';
import { StorageService } from '../../../../core/services/storage.service';
import { ExplorerMove, RepertoireEntry } from '../../../../core/models/opening.model';
import { Chessboard } from '../../../board/components/chessboard/chessboard';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

interface LineStep {
  readonly san: string;
  readonly uci: string;
  readonly fen: string;
}

/**
 * Opening explorer: play moves on the board (or click a row) and see what the
 * Lichess community plays from the position, with win rates and the opening
 * name (ECO). Lines can be saved to a local repertoire.
 */
@Component({
  selector: 'app-openings-explorer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Chessboard, DatePipe, DecimalPipe],
  templateUrl: './explorer.html',
  styleUrl: './explorer.scss',
})
export class OpeningsExplorer {
  private readonly service = inject(OpeningsService);
  private readonly storage = inject(StorageService);

  protected readonly line = signal<readonly LineStep[]>([]);
  protected readonly repertoire = signal<readonly RepertoireEntry[]>([]);
  protected readonly saved = signal(false);

  protected readonly fen = computed(() => this.line().at(-1)?.fen ?? START_FEN);
  protected readonly lastMove = computed(() => this.line().at(-1)?.uci ?? null);
  protected readonly sans = computed(() => this.line().map((s) => s.san).join(' '));

  protected readonly data = this.service.data;
  protected readonly isLoading = this.service.isLoading;
  protected readonly error = this.service.error;
  protected readonly totalGames = this.service.totalGames;

  protected readonly openingLabel = computed(() => {
    const opening = this.data()?.opening;
    return opening ? `${opening.eco} — ${opening.name}` : null;
  });

  constructor() {
    this.service.setFen(START_FEN);
    void this.storage.allRepertoire().then((r) => this.repertoire.set(r));
  }

  private apply(move: string | { from: string; to: string; promotion?: string }): void {
    const chess = new Chess(this.fen());
    let played;
    try {
      played = chess.move(move);
    } catch {
      return;
    }
    this.line.set([...this.line(), { san: played.san, uci: played.lan, fen: chess.fen() }]);
    this.saved.set(false);
    this.service.setFen(chess.fen());
  }

  protected onBoardMove(uci: string): void {
    this.apply({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined,
    });
  }

  protected playRow(move: ExplorerMove): void {
    this.apply(move.san);
  }

  protected undo(): void {
    this.line.set(this.line().slice(0, -1));
    this.saved.set(false);
    this.service.setFen(this.fen());
  }

  protected reset(): void {
    this.line.set([]);
    this.saved.set(false);
    this.service.setFen(START_FEN);
  }

  protected pct(count: number): number {
    const total = this.totalGames();
    return total === 0 ? 0 : Math.round((count / total) * 100);
  }

  protected rowTotal(move: ExplorerMove): number {
    return move.white + move.draws + move.black;
  }

  protected rowPct(move: ExplorerMove, share: number): number {
    const total = this.rowTotal(move);
    return total === 0 ? 0 : (share / total) * 100;
  }

  protected async addToRepertoire(): Promise<void> {
    if (this.line().length === 0) return;
    const opening = this.data()?.opening ?? null;
    const entry: RepertoireEntry = {
      id: crypto.randomUUID(),
      fen: this.fen(),
      line: this.sans(),
      eco: opening?.eco ?? null,
      name: opening?.name ?? null,
      addedAt: new Date(),
    };
    await this.storage.addRepertoire(entry);
    this.repertoire.set([entry, ...this.repertoire()]);
    this.saved.set(true);
  }

  protected loadEntry(entry: RepertoireEntry): void {
    const chess = new Chess();
    const steps: LineStep[] = [];
    for (const san of entry.line.split(/\s+/)) {
      if (!san) continue;
      try {
        const played = chess.move(san);
        steps.push({ san: played.san, uci: played.lan, fen: chess.fen() });
      } catch {
        break;
      }
    }
    this.line.set(steps);
    this.saved.set(true);
    this.service.setFen(this.fen());
  }

  protected async removeEntry(entry: RepertoireEntry): Promise<void> {
    await this.storage.removeRepertoire(entry.id);
    this.repertoire.set(this.repertoire().filter((r) => r.id !== entry.id));
  }
}
