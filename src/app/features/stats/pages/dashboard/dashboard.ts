import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PuzzleStore } from '../../../../core/store/puzzle.store';

/** Progression dashboard — solved totals, accuracy and recent attempts. */
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly store = inject(PuzzleStore);

  protected readonly solvedCount = this.store.solvedCount;
  protected readonly totalAttempts = this.store.totalAttempts;
  protected readonly accuracyPct = this.store.accuracyPct;
  protected readonly bestStreak = this.store.bestStreak;

  /** Ten most recent attempts, newest first. */
  protected readonly recent = computed(() =>
    [...this.store.attemptEntities()]
      .sort((a, b) => new Date(b.solvedAt).getTime() - new Date(a.solvedAt).getTime())
      .slice(0, 10),
  );

  constructor() {
    void this.store.hydrate();
  }
}
