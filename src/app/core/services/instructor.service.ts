import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Chess } from 'chess.js';

import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_API_URL,
  ANTHROPIC_MODEL,
  STOCKFISH_URL,
} from '../tokens/instructor.tokens';
import {
  AnthropicMessageResponse,
  CoachingMessage,
  CoachingTrigger,
  CoachingType,
  Difficulty,
} from '../models/instructor.model';
import { BotPersona } from '../models/bot.model';
import { EngineResult, StockfishEngine } from './stockfish-engine';

/**
 * Map a difficulty tier to a Stockfish "Skill Level" (≈ Elo):
 *  - beginner → 1  (≈ 600–800)
 *  - easy     → 4  (≈ 800–1000)
 *  - medium   → 8  (≈ 1000–1200)
 */
export function skillForDifficulty(difficulty: Difficulty): number {
  switch (difficulty) {
    case 'beginner':
      return 1;
    case 'easy':
      return 4;
    case 'medium':
      return 8;
  }
}

/** Human-like pause (600–900ms) so the bot never replies instantly. */
function humanDelayMs(): number {
  return 600 + Math.floor(Math.random() * 300);
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Pick a reasonable legal move with chess.js — used when the engine is unavailable. */
export function fallbackMove(fen: string): string {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return '';
  const capture = moves.find((m) => m.captured);
  const chosen = capture ?? moves[Math.floor(Math.random() * moves.length)];
  return `${chosen.from}${chosen.to}${chosen.promotion ?? ''}`;
}

const CAPTURE_VALUE: Readonly<Record<string, number>> = { q: 9, r: 5, b: 3, n: 3, p: 1 };

/**
 * Post-process the engine move according to a persona's style:
 * - `randomness`: chance to play any legal move instead (erratic bots)
 * - `captureBias`: chance to prefer the juiciest capture over a quiet move
 * Pure — `rand` injectable for tests.
 */
export function applyPersonaStyle(
  fen: string,
  engineUci: string,
  persona: BotPersona,
  rand: () => number = Math.random,
): string {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0 || !engineUci) return engineUci;
  const toUci = (m: { from: string; to: string; promotion?: string }): string =>
    `${m.from}${m.to}${m.promotion ?? ''}`;

  if (persona.randomness > 0 && rand() < persona.randomness) {
    return toUci(moves[Math.floor(rand() * moves.length)]);
  }

  if (persona.captureBias > 0) {
    const engineMove = moves.find((m) => toUci(m) === engineUci);
    const captures = moves.filter((m) => m.captured);
    if (captures.length > 0 && !engineMove?.captured && rand() < persona.captureBias) {
      const best = [...captures].sort(
        (a, b) => (CAPTURE_VALUE[b.captured ?? ''] ?? 0) - (CAPTURE_VALUE[a.captured ?? ''] ?? 0),
      )[0];
      return toUci(best);
    }
  }
  return engineUci;
}

export interface CoachRequest {
  readonly difficulty: Difficulty;
  readonly fen: string;
  readonly moveHistory: string; // SAN history, space-separated
  readonly type: CoachingType;
  readonly trigger: CoachingTrigger;
  readonly instruction: string; // the user-turn instruction for Claude
  /** Move the message talks about (UCI) — lets the local fallback be specific. */
  readonly moveUci?: string;
  /** Position BEFORE `moveUci` was played (the fen to replay it from). */
  readonly fenBefore?: string;
}

const DIFFICULTY_LABEL: Readonly<Record<Difficulty, string>> = {
  beginner: 'grand débutant',
  easy: 'débutant',
  medium: 'intermédiaire débutant',
};

const PIECE_FR: Readonly<Record<string, string>> = {
  p: 'pion',
  n: 'cavalier',
  b: 'fou',
  r: 'tour',
  q: 'dame',
  k: 'roi',
};

const CENTER_SQUARES = new Set(['d4', 'e4', 'd5', 'e5']);

interface MoveFacts {
  readonly san: string;
  readonly piece: string; // French piece name
  readonly from: string;
  readonly to: string;
  readonly captured: string | null; // French piece name
  readonly isCheckmate: boolean;
  readonly isCheck: boolean;
  readonly isCastle: boolean;
  readonly isPromotion: boolean;
  readonly toCenter: boolean;
  readonly develops: boolean; // minor piece leaving its starting rank
}

/** Replay `uci` from `fenBefore` and extract teachable facts (null if invalid). */
export function moveFacts(fenBefore: string, uci: string): MoveFacts | null {
  try {
    const chess = new Chess(fenBefore);
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : 'q',
    });
    const backRank = move.color === 'w' ? '1' : '8';
    return {
      san: move.san,
      piece: PIECE_FR[move.piece] ?? 'pièce',
      from: move.from,
      to: move.to,
      captured: move.captured ? (PIECE_FR[move.captured] ?? null) : null,
      isCheckmate: chess.isCheckmate(),
      isCheck: chess.inCheck(),
      isCastle: move.san.startsWith('O-O'),
      isPromotion: !!move.promotion,
      toCenter: CENTER_SQUARES.has(move.to),
      develops: (move.piece === 'n' || move.piece === 'b') && move.from[1] === backRank,
    };
  } catch {
    return null;
  }
}

/** The strongest teachable reason for a move, phrased for the given voice. */
function moveReason(f: MoveFacts, voice: 'player' | 'bot'): string {
  const your = voice === 'player' ? 'ton' : 'mon';
  if (f.isCheckmate) return "c'est échec et mat !";
  if (f.isCastle) return `${your} roi se met à l'abri et ${voice === 'player' ? 'ta' : 'ma'} tour s'active.`;
  if (f.isPromotion) return `${your} pion se transforme en dame — un énorme gain de force.`;
  if (f.captured) return `ça capture ${f.captured === 'dame' || f.captured === 'tour' ? 'la' : 'le'} ${f.captured} adverse.`;
  if (f.isCheck)
    return voice === 'player'
      ? "ça donne échec et force l'adversaire à réagir."
      : 'ça donne échec et te force à réagir.';
  if (f.develops) return `ça développe une pièce vers une case active.`;
  if (f.toCenter) return `ça prend le contrôle du centre.`;
  return `ça améliore la position ${voice === 'player' ? 'de tes pièces' : 'de mes pièces'}.`;
}

/**
 * Built-in French coaching used when no API key is configured or the call
 * fails. When the request carries the move (uci + fen before), the message
 * is derived from the actual position — piece, capture, check, castling,
 * centre, development — instead of a canned sentence.
 */
export function localCoaching(req: CoachRequest): string {
  const facts = req.moveUci && req.fenBefore ? moveFacts(req.fenBefore, req.moveUci) : null;

  if (facts) {
    switch (req.type) {
      case 'tip':
        // Hint: name the exact move and the strongest reason to play it.
        return `Joue ${facts.piece} ${facts.from} → ${facts.to} (${facts.san}) : ${moveReason(facts, 'player')}`;
      case 'praise':
        return `Bon coup ! ${facts.san} : ${moveReason(facts, 'player')}`;
      case 'warning':
        return `Attention après ${facts.san} — vérifie que tes pièces restent défendues.`;
      case 'explanation':
        return `Je joue ${facts.san} (${facts.piece} en ${facts.to}) : ${moveReason(facts, 'bot')}`;
    }
  }

  switch (req.type) {
    case 'praise':
      return 'Bon coup ! Tu développes ton jeu dans le bon sens.';
    case 'warning':
      return 'Attention, ce coup laisse une faiblesse. Réfléchis à la sécurité de tes pièces.';
    case 'tip':
      return 'Pense à amener une pièce vers une case plus active.';
    case 'explanation':
      return 'Je place ma pièce sur une case active pour développer mon jeu.';
  }
}

function buildSystemPrompt(difficulty: Difficulty, fen: string, moveHistory: string): string {
  return [
    "Tu es un instructeur d'échecs bienveillant qui enseigne à un débutant visant 1000 Elo.",
    'Tu expliques en français, avec des phrases courtes (max 2 lignes).',
    'Tu ne mentionnes jamais de variantes longues ni de théorie avancée.',
    `Niveau joueur : ${DIFFICULTY_LABEL[difficulty]}.`,
    `Position FEN actuelle : ${fen}.`,
    `Historique des coups (SAN) : ${moveHistory || '(début de partie)'}.`,
  ].join(' ');
}

/**
 * Orchestrates the two engines behind the Bot Instructor:
 *  - Stockfish (WASM, in a Worker) for bot moves and hint best-moves
 *  - Claude (Anthropic Messages API) for natural-language coaching
 */
@Injectable({ providedIn: 'root' })
export class InstructorService {
  private readonly apiKey = inject(ANTHROPIC_API_KEY);
  private readonly apiUrl = inject(ANTHROPIC_API_URL);
  private readonly model = inject(ANTHROPIC_MODEL);
  private readonly engineUrl = inject(STOCKFISH_URL);
  private readonly http = inject(HttpClient);
  private readonly doc = inject(DOCUMENT);

  private engine: StockfishEngine | null = null;

  private getEngine(): StockfishEngine {
    if (!this.engine) {
      const base = this.doc.baseURI;
      const scriptUrl = new URL(this.engineUrl, base).href;
      const wasmUrl = new URL(this.engineUrl.replace(/stockfish\.js$/, 'stockfish.wasm'), base).href;
      this.engine = new StockfishEngine(scriptUrl, wasmUrl);
    }
    return this.engine;
  }

  /** The bot's move for the current position (with a human-like delay). */
  async botMove(fen: string, difficulty: Difficulty, persona?: BotPersona | null): Promise<string> {
    const [uci] = await Promise.all([
      this.getEngine().bestMove(fen, {
        skill: persona?.skill ?? skillForDifficulty(difficulty),
        movetime: 600,
        contempt: persona?.contempt ?? 0,
      }),
      delay(humanDelayMs()),
    ]);
    const engineUci = uci ?? fallbackMove(fen);
    return persona ? applyPersonaStyle(fen, engineUci, persona) : engineUci;
  }

  /** Best move for a hint — deeper search (depth 12), no artificial delay. */
  async bestMove(fen: string, difficulty: Difficulty): Promise<string> {
    const uci = await this.getEngine().bestMove(fen, {
      skill: skillForDifficulty(difficulty),
      depth: 12,
    });
    return uci ?? fallbackMove(fen);
  }

  /** Full-strength evaluation of a position (Game Review, drills). */
  evaluate(fen: string, depth = 15): Promise<EngineResult> {
    return this.getEngine().go(fen, { skill: 20, depth });
  }

  /** Generate a coaching message via Claude (or a local fallback). */
  async coach(req: CoachRequest): Promise<CoachingMessage> {
    const text = await this.requestCoaching(req);
    return { type: req.type, text, triggeredBy: req.trigger };
  }

  private async requestCoaching(req: CoachRequest): Promise<string> {
    if (!this.apiKey) return localCoaching(req);
    try {
      const response = await firstValueFrom(
        this.http.post<AnthropicMessageResponse>(
          `${this.apiUrl}/v1/messages`,
          {
            model: this.model,
            max_tokens: 300,
            system: buildSystemPrompt(req.difficulty, req.fen, req.moveHistory),
            messages: [{ role: 'user', content: req.instruction }],
          },
          {
            headers: {
              'x-api-key': this.apiKey,
              'anthropic-version': '2023-06-01',
              // Required for direct browser calls (CORS). Exposes the key — see token docs.
              'anthropic-dangerous-direct-browser-access': 'true',
              'content-type': 'application/json',
            },
          },
        ),
      );
      const block = response.content.find((b) => b.type === 'text');
      return block?.text?.trim() || localCoaching(req);
    } catch {
      return localCoaching(req);
    }
  }
}
