import { InjectionToken } from '@angular/core';

/**
 * Base URL of the Lichess API. Injected (never hard-coded) so it can be
 * swapped for a mock in tests or pointed at a proxy.
 *
 * @see https://lichess.org/api — no auth required, 30 req/min per IP.
 */
export const LICHESS_API_URL = new InjectionToken<string>('LICHESS_API_URL', {
  providedIn: 'root',
  factory: () => 'https://lichess.org/api',
});
