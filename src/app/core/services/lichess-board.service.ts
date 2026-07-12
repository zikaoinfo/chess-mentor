import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { LICHESS_API_URL } from '../tokens/api.tokens';
import {
  LichessAccountEvent,
  LichessGameEvent,
  LichessUserStatus,
  OnlineGameConfig,
  OpenChallengeResponse,
} from '../models/online.model';
import { challengeBody, seekBody, splitNdjson } from '../../features/online/utils/online.utils';
import { LichessAuthService } from './lichess-auth.service';

/**
 * Client de l'API Board de Lichess.
 *
 * Les MUTATIONS (coup, seek, challenge, abandon, nulle) passent par
 * HttpClient, conformément au CLAUDE.md. Les STREAMS NDJSON utilisent
 * `fetch` + ReadableStream : ni httpResource ni HttpClient ne savent
 * consommer un flux ligne-à-ligne maintenu ouvert — c'est la déviation
 * documentée de ce fichier.
 */
@Injectable({ providedIn: 'root' })
export class LichessBoardService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(LichessAuthService);
  private readonly api = inject(LICHESS_API_URL);

  // ─── Streams (fetch + NDJSON) ─────────────────────────────────────────

  /**
   * Consomme un flux NDJSON et pousse chaque objet vers `onEvent`.
   * Résout quand le flux se termine ; rejette sur erreur réseau/HTTP.
   */
  private async consumeStream<T>(
    url: string,
    onEvent: (event: T) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const response = await fetch(url, { headers: this.auth.authHeader(), signal });
    if (!response.ok || !response.body) {
      throw new Error(`stream HTTP ${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      const { lines, rest } = splitNdjson(buffer, decoder.decode(value, { stream: true }));
      buffer = rest;
      for (const line of lines) onEvent(JSON.parse(line) as T);
    }
  }

  /**
   * Stream d'une partie, avec reconnexion automatique (backoff 1s→8s).
   * `onDisconnect`/`onReconnect` alimentent l'indicateur de connexion.
   */
  async streamGame(
    gameId: string,
    handlers: {
      onEvent: (event: LichessGameEvent) => void;
      onConnection: (connected: boolean) => void;
      isOver: () => boolean;
    },
    signal: AbortSignal,
  ): Promise<void> {
    let delayMs = 1000;
    while (!signal.aborted && !handlers.isOver()) {
      try {
        handlers.onConnection(true);
        await this.consumeStream<LichessGameEvent>(
          `${this.api}/board/game/stream/${gameId}`,
          (event) => {
            delayMs = 1000; // healthy stream → reset backoff
            handlers.onEvent(event);
          },
          signal,
        );
        // Flux terminé proprement (partie finie côté serveur).
        if (handlers.isOver()) return;
      } catch {
        if (signal.aborted) return;
      }
      handlers.onConnection(false);
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs = Math.min(delayMs * 2, 8000);
    }
  }

  /** Stream du compte : gameStart / gameFinish (détection du matchmaking). */
  streamAccountEvents(
    onEvent: (event: LichessAccountEvent) => void,
    signal: AbortSignal,
  ): Promise<void> {
    return this.consumeStream<LichessAccountEvent>(`${this.api}/stream/event`, onEvent, signal);
  }

  /**
   * Cherche un adversaire : la recherche reste active tant que la requête
   * est OUVERTE (particularité de /api/board/seek) — on la maintient via
   * fetch et on l'annule avec le signal quand un gameStart arrive.
   */
  async seek(config: OnlineGameConfig, signal: AbortSignal): Promise<void> {
    const response = await fetch(`${this.api}/board/seek`, {
      method: 'POST',
      headers: { ...this.auth.authHeader(), 'content-type': 'application/x-www-form-urlencoded' },
      body: seekBody(config),
      signal,
    });
    if (!response.ok) throw new Error(`seek HTTP ${response.status}`);
    // Draine la réponse jusqu'à l'abort (gameStart) ou la fin.
    await response.body?.getReader().read();
  }

  // ─── Mutations (HttpClient) ───────────────────────────────────────────

  private post<T>(path: string, body: string | null = null): Promise<T> {
    return firstValueFrom(
      this.http.post<T>(`${this.api}${path}`, body, {
        headers: {
          ...this.auth.authHeader(),
          ...(body !== null ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        },
      }),
    );
  }

  /** Joue un coup UCI (`e2e4`, `e7e8q`). */
  makeMove(gameId: string, uci: string): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>(`/board/game/${gameId}/move/${uci}`);
  }

  resign(gameId: string): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>(`/board/game/${gameId}/resign`);
  }

  /** Propose ou accepte la nulle (yes) / la refuse (no). */
  respondDraw(gameId: string, accept: boolean): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>(`/board/game/${gameId}/draw/${accept ? 'yes' : 'no'}`);
  }

  cancelChallenge(challengeId: string): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>(`/challenge/${challengeId}/cancel`);
  }

  /** Accepte un défi entrant : Lichess ouvre alors la partie (gameStart). */
  acceptChallenge(challengeId: string): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>(`/challenge/${challengeId}/accept`);
  }

  /** Refuse un défi entrant. */
  declineChallenge(challengeId: string): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>(`/challenge/${challengeId}/decline`);
  }

  /** Défie un joueur précis. */
  challengeUser(username: string, config: OnlineGameConfig): Promise<{ id: string }> {
    return this.post<{ id: string }>(`/challenge/${username}`, challengeBody(config));
  }

  /** Crée un défi ouvert : n'importe qui peut rejoindre via l'URL. */
  challengeOpen(config: OnlineGameConfig): Promise<OpenChallengeResponse> {
    return this.post<OpenChallengeResponse>('/challenge/open', challengeBody(config));
  }

  /**
   * Vérifie qu'un pseudo Lichess existe (GET /api/users/status). Renvoie la
   * casse officielle du compte si trouvé, `null` sinon — pour distinguer
   * « ce pseudo n'existe pas » d'un défi refusé pour une autre raison. Appel
   * en lecture ponctuel (validation à la soumission), donc HttpClient plutôt
   * que httpResource qui est pensé pour le binding réactif d'un composant.
   */
  async userExists(username: string): Promise<string | null> {
    const id = username.trim();
    if (!id) return null;
    try {
      const rows = await firstValueFrom(
        this.http.get<LichessUserStatus[]>(`${this.api}/users/status`, {
          params: { ids: id },
          headers: this.auth.authHeader(),
        }),
      );
      return rows.length > 0 ? rows[0].name : null;
    } catch {
      // Réseau/HS : on ne bloque pas le défi sur une validation best-effort.
      return id;
    }
  }
}
