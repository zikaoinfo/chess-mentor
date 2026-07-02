import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Chess } from 'chess.js';

import { StorageService } from '../../../../core/services/storage.service';
import { InstructorService } from '../../../../core/services/instructor.service';
import { EngineResult } from '../../../../core/services/stockfish-engine';
import { SavedGame } from '../../../../core/models/saved-game.model';
import {
  GamePhase,
  GameReview,
  MoveClass,
  MoveEval,
  ReviewCounts,
} from '../../../../core/models/analysis.model';
import { CoachingMessage } from '../../../../core/models/instructor.model';
import { Chessboard } from '../../../board/components/chessboard/chessboard';
import { classify, isSacrifice, phaseOf, toWhiteCp } from '../../utils/review.utils';

const CLASS_BADGE: Readonly<Record<MoveClass, string>> = {
  brilliant: '!!',
  best: '★',
  good: '✓',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
};

const CLASS_LABEL: Readonly<Record<MoveClass, string>> = {
  brilliant: 'brillant',
  best: 'meilleur coup',
  good: 'bon coup',
  inaccuracy: 'imprécision',
  mistake: 'erreur',
  blunder: 'gaffe',
};

interface ErrorDot {
  readonly x: number;
  readonly y: number;
  readonly ply: number;
  readonly cls: MoveClass;
}

/**
 * Game Review: replay any saved Instructor game move by move, analyse every
 * position with Stockfish (depth 15), classify moves, plot the eval curve,
 * and ask Claude to explain a given move.
 */
@Component({
  selector: 'app-game-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Chessboard, DatePipe],
  templateUrl: './game-review.html',
  styleUrl: './game-review.scss',
})
export class GameReviewPage {
  private readonly storage = inject(StorageService);
  private readonly instructor = inject(InstructorService);

  protected readonly games = signal<readonly SavedGame[]>([]);
  protected readonly selected = signal<SavedGame | null>(null);
  protected readonly ply = signal(0);
  protected readonly evals = signal<readonly MoveEval[] | null>(null);
  protected readonly analyzing = signal(false);
  protected readonly progress = signal(0);
  protected readonly explanation = signal<CoachingMessage | null>(null);
  protected readonly explaining = signal(false);

  /** Position before each ply: fens[0] = start, fens[i] = after i plies. */
  protected readonly fens = computed<readonly string[]>(() => {
    const game = this.selected();
    if (!game) return [];
    const chess = new Chess();
    const fens = [chess.fen()];
    for (const m of game.moves) {
      try {
        chess.move({
          from: m.uci.slice(0, 2),
          to: m.uci.slice(2, 4),
          promotion: m.uci.length > 4 ? m.uci[4] : undefined,
        });
      } catch {
        break;
      }
      fens.push(chess.fen());
    }
    return fens;
  });

  protected readonly currentFen = computed(
    () => this.fens()[this.ply()] ?? this.fens().at(-1) ?? '',
  );
  protected readonly currentLastMove = computed(() => {
    const ply = this.ply();
    return ply > 0 ? (this.selected()?.moves[ply - 1]?.uci ?? null) : null;
  });
  protected readonly maxPly = computed(() => Math.max(0, this.fens().length - 1));

  /** Current eval, white perspective, for the vertical bar. */
  protected readonly currentEval = computed(() => {
    const evals = this.evals();
    if (!evals?.length) return 0;
    const ply = this.ply();
    return ply === 0 ? evals[0].evalBefore : (evals[ply - 1]?.evalAfter ?? 0);
  });
  protected readonly whitePct = computed(
    () => 50 + Math.max(-600, Math.min(600, this.currentEval())) / 12,
  );

  /** Eval curve (one point per ply) in a 100×32 viewBox; zero line at y=16. */
  protected readonly curvePoints = computed(() => {
    const evals = this.evals();
    if (!evals?.length) return '';
    const n = evals.length;
    return evals
      .map((e, i) => {
        const x = n === 1 ? 50 : (i / (n - 1)) * 100;
        const y = 16 - (Math.max(-600, Math.min(600, e.evalAfter)) / 600) * 14;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  });

  protected readonly errorDots = computed<readonly ErrorDot[]>(() => {
    const evals = this.evals();
    if (!evals?.length) return [];
    const n = evals.length;
    return evals
      .filter((e) => e.cls === 'mistake' || e.cls === 'blunder')
      .map((e) => ({
        x: n === 1 ? 50 : ((e.ply - 1) / (n - 1)) * 100,
        y: 16 - (Math.max(-600, Math.min(600, e.evalAfter)) / 600) * 14,
        ply: e.ply,
        cls: e.cls,
      }));
  });

  protected readonly summary = computed(() => {
    const evals = this.evals();
    if (!evals) return null;
    const count = (by: 'player' | 'bot'): ReviewCounts => ({
      inaccuracy: evals.filter((e) => e.by === by && e.cls === 'inaccuracy').length,
      mistake: evals.filter((e) => e.by === by && e.cls === 'mistake').length,
      blunder: evals.filter((e) => e.by === by && e.cls === 'blunder').length,
    });
    return { player: count('player'), bot: count('bot') };
  });

  constructor() {
    void this.storage.allGames().then((games) => this.games.set(games));
  }

  protected select(game: SavedGame): void {
    this.selected.set(game);
    this.ply.set(0);
    this.evals.set(game.review?.evals ?? null);
    this.explanation.set(null);
  }

  protected back(): void {
    this.selected.set(null);
  }

  protected goTo(ply: number): void {
    this.ply.set(Math.max(0, Math.min(this.maxPly(), ply)));
    this.explanation.set(null);
  }

  protected badge(cls: MoveClass): string {
    return CLASS_BADGE[cls];
  }

  protected resultLabel(game: SavedGame): string {
    switch (game.result) {
      case 'white-wins':
        return '1-0';
      case 'black-wins':
        return '0-1';
      case 'draw':
        return '½-½';
      default:
        return '—';
    }
  }

  /** Run the full Stockfish review (depth 15 per position). */
  protected async analyze(): Promise<void> {
    const game = this.selected();
    if (!game || this.analyzing()) return;
    this.analyzing.set(true);
    this.progress.set(0);
    try {
      const fens = this.fens();
      const results: EngineResult[] = [];
      for (let i = 0; i < fens.length; i++) {
        results.push(await this.instructor.evaluate(fens[i], 15));
        this.progress.set(Math.round(((i + 1) / fens.length) * 100));
      }

      const evals: MoveEval[] = game.moves.slice(0, fens.length - 1).map((m, i) => {
        const whiteMoves = i % 2 === 0;
        const before = toWhiteCp(results[i], whiteMoves);
        const after = toWhiteCp(results[i + 1], !whiteMoves);
        const drop = whiteMoves ? before - after : after - before;
        const playedBest = results[i].uci === m.uci;
        const mateRaw = results[i + 1].mate;
        return {
          ply: i + 1,
          san: m.san,
          uci: m.uci,
          by: m.by,
          evalBefore: before,
          evalAfter: after,
          mateAfter: mateRaw === null ? null : !whiteMoves ? -mateRaw : mateRaw,
          bestUci: results[i].uci,
          cls: classify(drop, playedBest, isSacrifice(fens, i, whiteMoves ? 'w' : 'b')),
          phase: phaseOf(fens[i], i + 1),
        };
      });

      const phaseErrors: Record<GamePhase, number> = { opening: 0, middlegame: 0, endgame: 0 };
      for (const e of evals) {
        if (e.by === 'player' && (e.cls === 'inaccuracy' || e.cls === 'mistake' || e.cls === 'blunder')) {
          phaseErrors[e.phase] += 1;
        }
      }
      const count = (by: 'player' | 'bot'): ReviewCounts => ({
        inaccuracy: evals.filter((e) => e.by === by && e.cls === 'inaccuracy').length,
        mistake: evals.filter((e) => e.by === by && e.cls === 'mistake').length,
        blunder: evals.filter((e) => e.by === by && e.cls === 'blunder').length,
      });
      const review: GameReview = {
        analyzedAt: new Date(),
        player: count('player'),
        bot: count('bot'),
        playerPhaseErrors: phaseErrors,
        evals,
      };
      const updated: SavedGame = { ...game, review };
      await this.storage.updateGame(updated);
      this.selected.set(updated);
      this.evals.set(evals);
      this.games.set(this.games().map((g) => (g.id === updated.id ? updated : g)));
    } finally {
      this.analyzing.set(false);
    }
  }

  /** Ask Claude to explain the move at the current ply. */
  protected async explain(): Promise<void> {
    const game = this.selected();
    const evals = this.evals();
    const ply = this.ply();
    if (!game || !evals || ply === 0 || this.explaining()) return;
    const e = evals[ply - 1];
    if (!e) return;

    this.explaining.set(true);
    try {
      const message = await this.instructor.coach({
        difficulty: game.difficulty,
        fen: this.fens()[ply - 1],
        moveHistory: game.moves.slice(0, ply).map((m) => m.san).join(' '),
        type: 'explanation',
        trigger: 'game-review',
        instruction: `Explique le coup ${e.san} (classé ${CLASS_LABEL[e.cls]}, évaluation ${e.evalBefore} → ${e.evalAfter} centipions côté blanc${e.bestUci && e.bestUci !== e.uci ? `, le meilleur coup était ${e.bestUci}` : ''}). Une ou deux phrases simples pour un débutant.`,
      });
      this.explanation.set(message);
    } finally {
      this.explaining.set(false);
    }
  }
}
