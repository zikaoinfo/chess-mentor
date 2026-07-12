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

/** Auteur d'un défi tel que décrit par le stream de compte. */
export interface ChallengeUser {
  readonly id: string;
  readonly name: string;
  readonly rating?: number;
  readonly title?: string | null;
}

/** Défi brut du stream `/api/stream/event` (payload partiel qui nous concerne). */
export interface RawChallenge {
  readonly id: string;
  readonly url?: string;
  readonly status?: string;
  readonly challenger?: ChallengeUser | null;
  readonly destUser?: ChallengeUser | null;
  readonly rated?: boolean;
  readonly speed?: string;
  readonly color?: 'white' | 'black' | 'random';
  readonly finalColor?: 'white' | 'black';
  readonly timeControl?: {
    readonly type?: string;
    readonly limit?: number;
    readonly increment?: number;
    readonly show?: string;
  };
}

/** Événement `challenge` : quelqu'un nous défie (ou on défie quelqu'un). */
export interface ChallengeEvent {
  readonly type: 'challenge';
  readonly challenge: RawChallenge;
}

/** Événement `challengeCanceled` / `challengeDeclined` : un défi disparaît. */
export interface ChallengeGoneEvent {
  readonly type: 'challengeCanceled' | 'challengeDeclined';
  readonly challenge: Pick<RawChallenge, 'id'>;
}

export type LichessAccountEvent = GameStartEvent | ChallengeEvent | ChallengeGoneEvent;

/**
 * Défi entrant normalisé pour l'UI : ce qu'on affiche dans « X te défie ».
 * `mine` distingue un défi que J'AI envoyé (à ignorer dans la liste entrante)
 * d'un défi reçu.
 */
export interface IncomingChallenge {
  readonly id: string;
  readonly fromName: string;
  readonly fromRating: number | null;
  readonly rated: boolean;
  readonly speed: string;
  /** Cadence lisible (« 10+0 ») quand l'API la fournit. */
  readonly timeControl: string | null;
  readonly mine: boolean;
}

/** Réponse de GET /api/users/status?ids=… (validation d'un pseudo). */
export interface LichessUserStatus {
  readonly id: string;
  readonly name: string;
  readonly online?: boolean;
}

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
