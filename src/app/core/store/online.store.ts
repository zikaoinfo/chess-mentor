import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { Chess } from 'chess.js';

import {
  GameFullEvent,
  GameStateEvent,
  OnlineGameStatus,
  OnlinePlayer,
} from '../models/online.model';
import { isFinished, movesToPosition } from '../../features/online/utils/online.utils';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type OnlinePhase = 'idle' | 'seeking' | 'waiting' | 'playing' | 'finished';

interface OnlineState {
  readonly phase: OnlinePhase;
  readonly gameId: string | null;
  readonly myColor: 'white' | 'black';
  readonly fen: string;
  readonly moves: string; // liste UCI autoritaire du serveur
  readonly sanList: readonly string[];
  readonly lastMove: string | null;
  readonly inCheck: boolean;
  readonly wtime: number; // ms
  readonly btime: number; // ms
  /** Horodatage du dernier gameState — base du décompte local. */
  readonly clockSyncAt: number;
  readonly clockInitial: number | null; // secondes
  readonly clockIncrement: number | null;
  readonly rated: boolean;
  readonly status: OnlineGameStatus;
  readonly winner: 'white' | 'black' | null;
  readonly opponent: OnlinePlayer | null;
  readonly opponentDrawOffer: boolean;
  readonly connected: boolean;
  readonly shareUrl: string | null; // défi ouvert en attente
  readonly error: string | null;
}

const initialState: OnlineState = {
  phase: 'idle',
  gameId: null,
  myColor: 'white',
  fen: START_FEN,
  moves: '',
  sanList: [],
  lastMove: null,
  inCheck: false,
  wtime: 0,
  btime: 0,
  clockSyncAt: 0,
  clockInitial: null,
  clockIncrement: null,
  rated: false,
  status: 'created',
  winner: null,
  opponent: null,
  opponentDrawOffer: false,
  connected: false,
  shareUrl: null,
  error: null,
};

/**
 * État d'une partie en ligne (API Board Lichess). Le stream est la source
 * de vérité : chaque `gameState` reconstruit position et pendules ; le coup
 * local n'est appliqué qu'en optimiste et sera confirmé/écrasé par le flux.
 */
export const OnlineGameStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ fen, myColor, phase, status }) => ({
    isMyTurn: computed(() => {
      const turn = fen().split(' ')[1] === 'w' ? 'white' : 'black';
      return phase() === 'playing' && turn === myColor();
    }),
    isOver: computed(() => isFinished(status())),
  })),
  withMethods((store) => {
    function applyGameState(state: GameStateEvent): void {
      try {
        const position = movesToPosition(state.moves);
        const over = isFinished(state.status);
        const offer = store.myColor() === 'white' ? state.bdraw : state.wdraw;
        patchState(store, {
          fen: position.fen,
          moves: state.moves,
          sanList: position.sanList,
          lastMove: position.lastUci,
          inCheck: position.inCheck,
          wtime: state.wtime,
          btime: state.btime,
          clockSyncAt: Date.now(),
          status: state.status,
          winner: state.winner ?? null,
          opponentDrawOffer: offer === true,
          phase: over ? 'finished' : 'playing',
        });
      } catch {
        patchState(store, { error: 'État de partie illisible reçu du serveur.' });
      }
    }

    return {
    applyGameState,

    startSeeking(): void {
      patchState(store, { ...initialState, phase: 'seeking' });
    },

    startWaiting(shareUrl: string): void {
      patchState(store, { ...initialState, phase: 'waiting', shareUrl });
    },

    /** gameStart reçu : on connaît la partie et notre couleur. */
    enterGame(gameId: string, myColor: 'white' | 'black'): void {
      patchState(store, { ...initialState, phase: 'playing', gameId, myColor });
    },

    applyGameFull(event: GameFullEvent, myName: string): void {
      const iAmWhite = (event.white.name ?? '').toLowerCase() === myName.toLowerCase();
      const opp = iAmWhite ? event.black : event.white;
      patchState(store, {
        myColor: iAmWhite ? 'white' : 'black',
        rated: event.rated,
        clockInitial: event.clock ? Math.round(event.clock.initial / 1000) : null,
        clockIncrement: event.clock ? Math.round(event.clock.increment / 1000) : null,
        opponent: {
          name: opp.name ?? (opp.aiLevel !== undefined ? `Stockfish niv. ${opp.aiLevel}` : '?'),
          rating: opp.rating ?? null,
          title: opp.title ?? null,
        },
      });
      applyGameState(event.state);
    },

    /** Application optimiste du coup local — le stream confirmera. */
    applyLocalMove(uci: string): boolean {
      try {
        const chess = new Chess(store.fen());
        chess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.length > 4 ? uci[4] : undefined,
        });
        patchState(store, { fen: chess.fen(), lastMove: uci, inCheck: chess.inCheck() });
        return true;
      } catch {
        return false;
      }
    },

    /** Annule l'optimisme local : on repart des coups confirmés serveur. */
    revertToServer(): void {
      try {
        const position = movesToPosition(store.moves());
        patchState(store, {
          fen: position.fen,
          lastMove: position.lastUci,
          inCheck: position.inCheck,
        });
      } catch {
        // moves() vient du serveur : ne devrait jamais échouer.
      }
    },

    setConnected(connected: boolean): void {
      patchState(store, { connected });
    },

    setError(error: string | null): void {
      patchState(store, { error });
    },

    reset(): void {
      patchState(store, initialState);
    },
    };
  }),
);
