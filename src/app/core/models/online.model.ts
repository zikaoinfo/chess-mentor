/** Configuration d'une partie en ligne (seek ou challenge). */
export interface OnlineGameConfig {
  /** Temps initial en minutes (Board API : rapide et plus lent uniquement). */
  readonly limitMinutes: number;
  /** Incrément en secondes. */
  readonly incrementSeconds: number;
  readonly rated: boolean;
  readonly color: 'white' | 'black' | 'random';
}

/** Joueur distant tel que décrit par le stream Lichess. */
export interface OnlinePlayer {
  readonly name: string;
  readonly rating: number | null;
  readonly title: string | null;
}

/** Statuts de partie renvoyés par l'API Board. */
export type OnlineGameStatus =
  | 'created'
  | 'started'
  | 'aborted'
  | 'mate'
  | 'resign'
  | 'stalemate'
  | 'timeout'
  | 'draw'
  | 'outoftime'
  | 'cheat'
  | 'noStart'
  | 'unknownFinish'
  | 'variantEnd';

/** `gameState` du stream Board — l'état autoritaire de la partie. */
export interface GameStateEvent {
  readonly type: 'gameState';
  /** Coups UCI séparés par des espaces, depuis le début de la partie. */
  readonly moves: string;
  readonly wtime: number; // ms restants Blancs
  readonly btime: number; // ms restants Noirs
  readonly status: OnlineGameStatus;
  readonly winner?: 'white' | 'black';
  readonly wdraw?: boolean;
  readonly bdraw?: boolean;
}

interface StreamPlayer {
  readonly id?: string;
  readonly name?: string;
  readonly rating?: number;
  readonly title?: string | null;
  readonly aiLevel?: number;
}

/** Premier événement du stream d'une partie : description complète. */
export interface GameFullEvent {
  readonly type: 'gameFull';
  readonly id: string;
  readonly rated: boolean;
  readonly clock: { readonly initial: number; readonly increment: number } | null;
  readonly white: StreamPlayer;
  readonly black: StreamPlayer;
  readonly state: GameStateEvent;
}

export interface ChatLineEvent {
  readonly type: 'chatLine';
  readonly username: string;
  readonly text: string;
}

export type LichessGameEvent = GameFullEvent | GameStateEvent | ChatLineEvent;

/** Événements du stream de compte (`/api/stream/event`). */
export interface GameStartEvent {
  readonly type: 'gameStart' | 'gameFinish';
  readonly game: {
    readonly gameId: string;
    readonly color: 'white' | 'black';
    readonly opponent?: { readonly username?: string; readonly rating?: number };
  };
}

export interface AccountEventOther {
  readonly type: 'challenge' | 'challengeCanceled' | 'challengeDeclined';
}

export type LichessAccountEvent = GameStartEvent | AccountEventOther;

/** Compte Lichess minimal (réponse de /api/account). */
export interface LichessAccount {
  readonly id: string;
  readonly username: string;
}

/** Réponse de POST /api/token (échange PKCE). */
export interface LichessTokenResponse {
  readonly token_type: string;
  readonly access_token: string;
  readonly expires_in?: number;
}

/** Réponse de POST /api/challenge/open. */
export interface OpenChallengeResponse {
  readonly id: string;
  readonly url: string;
  readonly urlWhite?: string;
  readonly urlBlack?: string;
}
