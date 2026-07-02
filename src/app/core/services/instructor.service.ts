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

export interface CoachRequest {
  readonly difficulty: Difficulty;
  readonly fen: string;
  readonly moveHistory: string; // SAN history, space-separated
  readonly type: CoachingType;
  readonly trigger: CoachingTrigger;
  readonly instruction: string; // the user-turn instruction for Claude
}

const DIFFICULTY_LABEL: Readonly<Record<Difficulty, string>> = {
  beginner: 'grand débutant',
  easy: 'débutant',
  medium: 'intermédiaire débutant',
};

/** Built-in French coaching used when no API key is configured or the call fails. */
function localCoaching(req: CoachRequest): string {
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
  async botMove(fen: string, difficulty: Difficulty): Promise<string> {
    const [uci] = await Promise.all([
      this.getEngine().bestMove(fen, { skill: skillForDifficulty(difficulty), movetime: 600 }),
      delay(humanDelayMs()),
    ]);
    return uci ?? fallbackMove(fen);
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
