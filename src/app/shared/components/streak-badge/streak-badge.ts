import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Small badge showing the solver's current streak of clean solves. */
@Component({
  selector: 'app-streak-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class.badge--hot]="hot()" [attr.aria-label]="label()">
      <span class="flame" aria-hidden="true">🔥</span>
      <span class="count">{{ streak() }}</span>
    </span>
  `,
  styleUrl: './streak-badge.scss',
})
export class StreakBadge {
  readonly streak = input.required<number>();

  protected readonly hot = computed(() => this.streak() >= 3);
  protected readonly label = computed(() => `Série de ${this.streak()} puzzles réussis`);
}
