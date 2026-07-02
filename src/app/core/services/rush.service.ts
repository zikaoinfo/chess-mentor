import { computed, inject, Injectable, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { LICHESS_API_URL } from '../tokens/api.tokens';
import { LichessApiResponse, LichessPuzzle } from '../models/puzzle.model';
import { RushDifficulty } from '../models/rush.model';
import { toPuzzle } from './puzzle.service';

/**
 * Puzzle feed for Puzzle Rush: same Lichess endpoint as the trainer but with
 * the `difficulty` parameter, ramped up as the streak grows.
 */
@Injectable({ providedIn: 'root' })
export class RushService {
  private readonly apiUrl = inject(LICHESS_API_URL);

  readonly difficulty = signal<RushDifficulty>('easiest');

  private readonly resource = httpResource<LichessApiResponse>(
    () => `${this.apiUrl}/puzzle/next?difficulty=${this.difficulty()}`,
  );

  readonly puzzle = computed<LichessPuzzle | null>(() => {
    const value = this.resource.value();
    return value ? toPuzzle(value) : null;
  });
  readonly isLoading = this.resource.isLoading;
  readonly error = this.resource.error;

  setDifficulty(difficulty: RushDifficulty): void {
    this.difficulty.set(difficulty);
  }

  /** Pull a fresh puzzle at the current difficulty. */
  next(): void {
    this.resource.reload();
  }
}
