import { computed, inject, Injectable, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { LICHESS_API_URL, LICHESS_HOST_URL } from '../tokens/api.tokens';
import { LichessAccount, LichessTokenResponse } from '../models/online.model';
import { StorageService } from './storage.service';
import { challengeS256, randomVerifier } from '../../features/online/utils/pkce.utils';

/** Clés du magasin `settings` (jamais localStorage — cf. CLAUDE.md). */
const TOKEN_KEY = 'lichess.token';
const USER_KEY = 'lichess.username';
const VERIFIER_KEY = 'lichess.pkce.verifier';
const STATE_KEY = 'lichess.pkce.state';

/**
 * OAuth2 PKCE contre Lichess (scope `board:play`). Client public : pas de
 * secret, pas d'enregistrement préalable — le `client_id` est un identifiant
 * libre et le `code_verifier` fait la preuve. Le token (longue durée chez
 * Lichess, pas de refresh token en PKCE) est conservé dans IndexedDB via le
 * StorageService.
 */
@Injectable({ providedIn: 'root' })
export class LichessAuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);
  private readonly host = inject(LICHESS_HOST_URL);
  private readonly api = inject(LICHESS_API_URL);
  private readonly doc = inject(DOCUMENT);

  private readonly tokenSignal = signal<string | null>(null);
  readonly username = signal<string | null>(null);
  /** True once the stored session has been loaded (avoid login-flash). */
  readonly ready = signal(false);
  readonly error = signal<string | null>(null);

  readonly token = this.tokenSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.tokenSignal() !== null);

  private readonly clientId = 'chessmentor-pwa';

  /** Where Lichess sends the user back: the online page itself. */
  private redirectUri(): string {
    return new URL('online', this.doc.baseURI).href;
  }

  /** Restore a stored session; drops the token if Lichess rejects it. */
  async init(): Promise<void> {
    if (this.ready()) return;
    try {
      const token = await this.storage.getSetting<string>(TOKEN_KEY);
      const username = await this.storage.getSetting<string>(USER_KEY);
      if (token) {
        this.tokenSignal.set(token);
        this.username.set(username);
        void this.refreshAccount();
      }
    } catch {
      // Storage unavailable: continue logged-out rather than hang the page.
    } finally {
      // MUST always run — the online page gates its whole UI on `ready`.
      this.ready.set(true);
    }
  }

  /** Start the PKCE flow — leaves the app for lichess.org/oauth. */
  async login(): Promise<void> {
    const verifier = randomVerifier();
    const state = randomVerifier(32);
    await this.storage.setSetting(VERIFIER_KEY, verifier);
    await this.storage.setSetting(STATE_KEY, state);
    const challenge = await challengeS256(verifier);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri(),
      scope: 'board:play',
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
    });
    this.doc.location.href = `${this.host}/oauth?${params}`;
  }

  /** Exchange the callback `code` for a token. Returns true on success. */
  async handleCallback(code: string, state: string): Promise<boolean> {
    this.error.set(null);
    const expectedState = await this.storage.getSetting<string>(STATE_KEY);
    const verifier = await this.storage.getSetting<string>(VERIFIER_KEY);
    await this.storage.removeSetting(STATE_KEY);
    await this.storage.removeSetting(VERIFIER_KEY);
    if (!verifier || !expectedState || state !== expectedState) {
      this.error.set('Connexion refusée : état OAuth invalide. Réessaie.');
      return false;
    }
    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        redirect_uri: this.redirectUri(),
        client_id: this.clientId,
      });
      const res = await firstValueFrom(
        this.http.post<LichessTokenResponse>(`${this.api}/token`, body.toString(), {
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        }),
      );
      this.tokenSignal.set(res.access_token);
      await this.storage.setSetting(TOKEN_KEY, res.access_token);
      await this.refreshAccount();
      return true;
    } catch {
      this.error.set('Échange du code OAuth impossible. Réessaie.');
      return false;
    }
  }

  /** Fetch /api/account to display the username & validate the token. */
  private async refreshAccount(): Promise<void> {
    try {
      const account = await firstValueFrom(
        this.http.get<LichessAccount>(`${this.api}/account`, { headers: this.authHeader() }),
      );
      this.username.set(account.username);
      await this.storage.setSetting(USER_KEY, account.username);
    } catch (error) {
      // Only a genuine 401/403 means the token is dead → force re-login.
      // A network hiccup (offline, transient 5xx) must NOT drop the session.
      if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
        await this.logout();
      }
    }
  }

  async logout(): Promise<void> {
    const token = this.tokenSignal();
    this.tokenSignal.set(null);
    this.username.set(null);
    await this.storage.removeSetting(TOKEN_KEY);
    await this.storage.removeSetting(USER_KEY);
    if (token) {
      // Best effort: revoke server-side too.
      try {
        await firstValueFrom(
          this.http.delete(`${this.api}/token`, { headers: { Authorization: `Bearer ${token}` } }),
        );
      } catch {
        // The local session is gone either way.
      }
    }
  }

  authHeader(): Record<string, string> {
    const token = this.tokenSignal();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}
