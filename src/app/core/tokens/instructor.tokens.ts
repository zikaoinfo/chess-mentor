import { InjectionToken } from '@angular/core';

/**
 * Anthropic API configuration for the coaching feature. Injected (never
 * hard-coded) so it can be supplied per-environment and mocked in tests.
 *
 * ⚠️ SECURITY: a non-empty `ANTHROPIC_API_KEY` here ships to the browser and is
 * publicly readable. This is acceptable only for local/demo use. For production,
 * proxy the call through a small backend that holds the key server-side and
 * point `ANTHROPIC_API_URL` at that proxy. When the key is empty (the default),
 * the app falls back to built-in local coaching messages — no network call.
 */
export const ANTHROPIC_API_KEY = new InjectionToken<string>('ANTHROPIC_API_KEY', {
  providedIn: 'root',
  factory: () => '',
});

export const ANTHROPIC_API_URL = new InjectionToken<string>('ANTHROPIC_API_URL', {
  providedIn: 'root',
  factory: () => 'https://api.anthropic.com',
});

/** Model id used for coaching (short, fast responses). */
export const ANTHROPIC_MODEL = new InjectionToken<string>('ANTHROPIC_MODEL', {
  providedIn: 'root',
  factory: () => 'claude-opus-4-8',
});

/** Path to the vendored single-threaded Stockfish engine (UCI over a Worker). */
export const STOCKFISH_URL = new InjectionToken<string>('STOCKFISH_URL', {
  providedIn: 'root',
  factory: () => 'assets/engine/stockfish.js',
});
