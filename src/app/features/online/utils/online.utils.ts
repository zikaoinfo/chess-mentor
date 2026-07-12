import { Chess } from 'chess.js';
import {
  GameStateEvent,
  IncomingChallenge,
  OnlineGameConfig,
  OnlineGameStatus,
  RawChallenge,
} from '../../../core/models/online.model';

/**
 * NDJSON incremental parser: feed chunks, get complete JSON lines back.
 * Lichess streams keep-alive newlines — blank lines are skipped.
 */
export function splitNdjson(buffer: string, chunk: string): { lines: string[]; rest: string } {
  const combined = buffer + chunk;
  const parts = combined.split('\n');
  const rest = parts.pop() ?? '';
  return { lines: parts.map((l) => l.trim()).filter((l) => l.length > 0), rest };
}

/** Replay a Board-API move list ("e2e4 e7e5 …") from the standard start. */
export function movesToPosition(moves: string): {
  fen: string;
  lastUci: string | null;
  sanList: readonly string[];
  inCheck: boolean;
} {
  const chess = new Chess();
  const sanList: string[] = [];
  const ucis = moves.split(' ').filter((m) => m.length > 0);
  for (const uci of ucis) {
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined,
    });
    sanList.push(move.san);
  }
  return {
    fen: chess.fen(),
    lastUci: ucis.at(-1) ?? null,
    sanList,
    inCheck: chess.inCheck(),
  };
}

/** Statuses after which the game is over. */
const FINISHED: ReadonlySet<OnlineGameStatus> = new Set([
  'aborted',
  'mate',
  'resign',
  'stalemate',
  'timeout',
  'draw',
  'outoftime',
  'cheat',
  'noStart',
  'unknownFinish',
  'variantEnd',
]);

export function isFinished(status: OnlineGameStatus): boolean {
  return FINISHED.has(status);
}

/** French label for a game result, from the player's perspective. */
export function resultLabel(
  state: Pick<GameStateEvent, 'status' | 'winner'>,
  myColor: 'white' | 'black',
): string {
  if (state.status === 'aborted' || state.status === 'noStart') return 'Partie annulée';
  if (state.status === 'draw' || state.status === 'stalemate') return 'Partie nulle';
  if (!state.winner) return 'Partie terminée';
  const won = state.winner === myColor;
  const how =
    state.status === 'mate'
      ? won ? 'par échec et mat' : 'sur échec et mat'
      : state.status === 'resign'
        ? won ? 'par abandon adverse' : 'par abandon'
        : state.status === 'outoftime' || state.status === 'timeout'
          ? 'au temps'
          : '';
  return `${won ? 'Victoire' : 'Défaite'}${how ? ' ' + how : ''} !`;
}

/** Form body for POST /api/board/seek. */
export function seekBody(config: OnlineGameConfig): string {
  const params = new URLSearchParams({
    time: String(config.limitMinutes),
    increment: String(config.incrementSeconds),
    rated: String(config.rated),
  });
  // Lichess only honours a colour choice on casual seeks.
  if (!config.rated && config.color !== 'random') params.set('color', config.color);
  return params.toString();
}

/** Form body for POST /api/challenge/{user} and /api/challenge/open. */
export function challengeBody(config: OnlineGameConfig): string {
  const params = new URLSearchParams({
    'clock.limit': String(config.limitMinutes * 60),
    'clock.increment': String(config.incrementSeconds),
    rated: String(config.rated),
  });
  if (config.color !== 'random') params.set('color', config.color);
  return params.toString();
}

/**
 * Normalise un défi brut du stream en une entrée d'UI. `myName` sert à
 * repérer les défis que J'AI émis (challenger == moi) : on les marque `mine`
 * pour ne pas les afficher comme « quelqu'un te défie ».
 */
export function toIncomingChallenge(raw: RawChallenge, myName: string): IncomingChallenge {
  const challenger = raw.challenger ?? null;
  const mine = (challenger?.name ?? '').toLowerCase() === myName.trim().toLowerCase();
  return {
    id: raw.id,
    fromName: challenger?.name ?? '?',
    fromRating: challenger?.rating ?? null,
    rated: raw.rated === true,
    speed: raw.speed ?? '',
    timeControl: raw.timeControl?.show ?? null,
    mine,
  };
}

/** Texte prêt à partager pour inviter un ami à une partie (Web Share / copie). */
export function shareInviteText(url: string): string {
  return `Rejoins-moi pour une partie d'échecs sur ChessMentor : ${url}`;
}

/** mm:ss (or h:mm:ss beyond an hour), clamped at zero. */
export function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${m}:${String(s).padStart(2, '0')}`;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : mmss;
}
