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

/**
 * Base URL of the Lichess opening explorer (separate host from the main API).
 * @see https://lichess.org/api#tag/Opening-Explorer
 */
export const EXPLORER_API_URL = new InjectionToken<string>('EXPLORER_API_URL', {
  providedIn: 'root',
  factory: () => 'https://explorer.lichess.ovh',
});

/**
 * Lichess site host (OAuth authorize page lives at /oauth, outside /api).
 * @see https://lichess.org/api#tag/OAuth
 */
export const LICHESS_HOST_URL = new InjectionToken<string>('LICHESS_HOST_URL', {
  providedIn: 'root',
  factory: () => 'https://lichess.org',
});
