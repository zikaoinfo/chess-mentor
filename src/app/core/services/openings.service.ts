import { computed, inject, Injectable, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { EXPLORER_API_URL } from '../tokens/api.tokens';
import { ExplorerResponse } from '../models/opening.model';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Lichess opening explorer. The resource refetches whenever `fen` changes;
 * `httpResource` tracks loading/error/value.
 */
@Injectable({ providedIn: 'root' })
export class OpeningsService {
  private readonly apiUrl = inject(EXPLORER_API_URL);

  /** Position currently explored. */
  readonly fen = signal(START_FEN);

  private readonly resource = httpResource<ExplorerResponse>(
    () =>
      `${this.apiUrl}/lichess?variant=standard&fen=${encodeURIComponent(this.fen())}` +
      `&moves=12&topGames=0&recentGames=0`,
  );

  readonly data = this.resource.value;
  readonly isLoading = this.resource.isLoading;
  readonly error = this.resource.error;

  /** Total games in the current position, for percentages. */
  readonly totalGames = computed(() => {
    const d = this.data();
    return d ? d.white + d.draws + d.black : 0;
  });

  setFen(fen: string): void {
    this.fen.set(fen);
  }
}
