import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { Chess } from 'chess.js';

import {
  CoachingMessage,
  Difficulty,
  GameResult,
  HintState,
  InstructorMove,
  InstructorPhase,
} from '../models/instructor.model';
import { InstructorService } from '../services/instructor.service';
import { SoundService } from '../services/sound.service';
import { StorageService } from '../services/storage.service';
import { BotPersona } from '../models/bot.model';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

interface InstructorState {
  readonly difficulty: Difficulty;
  readonly phase: InstructorPhase;
  readonly currentFen: string;
  readonly moveHistory: readonly InstructorMove[];
  readonly hint: HintState | null;
  readonly coaching: CoachingMessage | null;
  /** True while a Claude coaching request is in flight (shimmer in the panel). */
  readonly coachingLoading: boolean;
  readonly playerColor: 'white' | 'black';
  /** Bot persona for the current game (null = default coach). */
  readonly bot: BotPersona | null;
  /** Set when the game ends (checkmate winner, or draw/stalemate). */
  readonly gameResult: GameResult | null;
  /** True when the side to move is in check. */
  readonly inCheck: boolean;
  /** Id of the last game persisted for review (set at game over). */
  readonly lastGameId: string | null;
}

const initialState: InstructorState = {
  difficulty: 'beginner',
  phase: 'idle',
  currentFen: START_FEN,
  moveHistory: [],
  hint: null,
  coaching: null,
  coachingLoading: false,
  bot: null,
  playerColor: 'white',
  gameResult: null,
  inCheck: false,
  lastGameId: null,
};

function uciToMove(uci: string): { from: string; to: string; promotion?: string } {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined };
}

function sanHistory(moves: readonly InstructorMove[]): string {
  return moves.map((m) => m.san).join(' ');
}

/** End-of-game verdict + check flag for the position held by `chess`. */
function verdict(chess: Chess): { over: boolean; gameResult: GameResult | null; inCheck: boolean } {
  const over = chess.isGameOver();
  const gameResult: GameResult | null = !over
    ? null
    : chess.isCheckmate()
      ? // The side to move is the one mated.
        chess.turn() === 'w'
        ? 'black-wins'
        : 'white-wins'
      : 'draw'; // stalemate, 50 moves, repetition, insufficient material
  return { over, gameResult, inCheck: chess.inCheck() };
}

/**
 * Global store for a coached game against the bot. Owns the position, move
 * history, current hint and coaching bubble, and the phase machine
 * (idle → player-turn ↔ bot-thinking → … → game-over). chess.js validates and
 * applies moves; the InstructorService supplies bot moves and coaching.
 */
export const InstructorStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ phase, moveHistory }) => ({
    isPlayerTurn: computed(() => phase() === 'player-turn'),
    isThinking: computed(() => phase() === 'bot-thinking'),
    isGameOver: computed(() => phase() === 'game-over'),
    /** Last move played, UCI, for board highlighting. */
    lastMove: computed(() => moveHistory().at(-1)?.uci ?? null),
  })),
  withMethods(
    (
      store,
      service = inject(InstructorService),
      sound = inject(SoundService),
      storage = inject(StorageService),
    ) => {
    // Persist the finished game locally for Game Review & Insights.
    function persistGame(): void {
      const moves = store.moveHistory();
      if (moves.length === 0) return;
      const id = crypto.randomUUID();
      patchState(store, { lastGameId: id });
      void storage.saveGame({
        id,
        playedAt: new Date(),
        playerColor: store.playerColor(),
        difficulty: store.difficulty(),
        result: store.gameResult(),
        moves,
        botName: store.bot()?.name,
      });
    }

    // One sound per move: game-over > check > capture > plain move.
    function moveSound(move: { san: string; captured?: string }, over: boolean): void {
      if (over) sound.gameOver();
      else if (move.san.includes('+')) sound.check();
      else if (move.captured) sound.capture();
      else sound.move();
    }

    function applyBotMove(): void {
      void runBot();
    }

    async function runBot(): Promise<void> {
      const fen = store.currentFen();
      const difficulty = store.difficulty();
      patchState(store, { phase: 'bot-thinking' });

      const uci = await service.botMove(fen, difficulty, store.bot());
      const chess = new Chess(fen);
      let move;
      try {
        move = uci ? chess.move(uciToMove(uci)) : null;
      } catch {
        move = null;
      }
      if (!move) {
        // Engine produced no playable move — settle the game from the position.
        const end = verdict(chess);
        patchState(store, {
          phase: store.phase() === 'bot-thinking' ? 'game-over' : store.phase(),
          gameResult: end.gameResult,
          inCheck: end.inCheck,
        });
        if (store.phase() === 'game-over') persistGame();
        return;
      }

      const newFen = chess.fen();
      const { over, gameResult, inCheck } = verdict(chess);
      const botMove: InstructorMove = { uci: move.lan, san: move.san, by: 'bot' };
      patchState(store, {
        currentFen: newFen,
        moveHistory: [...store.moveHistory(), botMove],
        phase: over ? 'game-over' : 'player-turn',
        gameResult,
        inCheck,
        coachingLoading: true,
      });
      moveSound(move, over);
      if (over) persistGame();

      // Explain the bot move in natural language (async — attach when ready).
      const coaching = await service.coach({
        difficulty,
        fen: newFen,
        moveHistory: sanHistory(store.moveHistory()),
        type: 'explanation',
        trigger: 'bot-move',
        instruction: `Tu joues contre un débutant. Tu (le bot) viens de jouer ${move.san}. Explique en une phrase simple pourquoi tu joues ce coup, sans donner de longue variante.`,
        moveUci: move.lan,
        fenBefore: fen,
      });
      patchState(store, {
        coaching,
        coachingLoading: false,
        moveHistory: store
          .moveHistory()
          .map((m, i, arr) => (i === arr.length - 1 && m.by === 'bot' ? { ...m, explanation: coaching.text } : m)),
      });
    }

    async function coachPlayerMove(
      san: string,
      fen: string,
      difficulty: Difficulty,
      moveUci: string,
      fenBefore: string,
    ): Promise<void> {
      const coaching = await service.coach({
        difficulty,
        fen,
        moveHistory: sanHistory(store.moveHistory()),
        type: 'tip',
        trigger: 'player-move',
        instruction: `Le joueur vient de jouer ${san}. Évalue ce coup en une phrase (bon, acceptable, ou à éviter) sans dévoiler la suite de la partie.`,
        moveUci,
        fenBefore,
      });
      // Only surface if the bot hasn't already spoken about its reply.
      if (store.phase() === 'bot-thinking') {
        patchState(store, { coaching, coachingLoading: false });
      } else if (store.phase() === 'game-over') {
        // Player's move ended the game — no bot reply will follow.
        patchState(store, { coachingLoading: false });
      }
    }

    return {
      /** Start a fresh coached game, optionally against a bot persona. */
      newGame(
        difficulty: Difficulty,
        playerColor: 'white' | 'black' = 'white',
        bot: BotPersona | null = null,
      ): void {
        patchState(store, {
          ...initialState,
          difficulty,
          playerColor,
          bot,
          phase: playerColor === 'white' ? 'player-turn' : 'bot-thinking',
          coaching: bot
            ? { type: 'explanation', text: `${bot.avatar} ${bot.intro}`, triggeredBy: 'bot-move' }
            : null,
        });
        if (playerColor === 'black') applyBotMove();
      },

      setDifficulty(difficulty: Difficulty): void {
        patchState(store, { difficulty });
      },

      /** Attempt the solver's move (UCI). Returns false if illegal / not their turn. */
      playerMove(uci: string): boolean {
        if (store.phase() !== 'player-turn') return false;

        const fenBefore = store.currentFen();
        const chess = new Chess(fenBefore);
        let move;
        try {
          move = chess.move(uciToMove(uci));
        } catch {
          move = null;
        }
        if (!move) return false;

        const playerMove: InstructorMove = { uci: move.lan, san: move.san, by: 'player' };
        const { over, gameResult, inCheck } = verdict(chess);
        patchState(store, {
          currentFen: chess.fen(),
          moveHistory: [...store.moveHistory(), playerMove],
          hint: null,
          coaching: null,
          coachingLoading: true,
          phase: over ? 'game-over' : 'bot-thinking',
          gameResult,
          inCheck,
        });
        moveSound(move, over);
        if (over) persistGame();

        void coachPlayerMove(move.san, chess.fen(), store.difficulty(), move.lan, fenBefore);
        if (!over) applyBotMove();
        return true;
      },

      /** Request a hint: best move from Stockfish + a Claude explanation. */
      async requestHint(): Promise<void> {
        if (store.phase() !== 'player-turn') return;
        const fen = store.currentFen();
        const difficulty = store.difficulty();
        const best = await service.bestMove(fen);
        if (!best || store.phase() !== 'player-turn') return;

        const from = best.slice(0, 2);
        const to = best.slice(2, 4);
        patchState(store, {
          hint: { from, to, reason: 'Regarde ce coup.', arrows: [{ from, to }] },
          coachingLoading: true,
        });
        sound.hint();

        const coaching = await service.coach({
          difficulty,
          fen,
          moveHistory: sanHistory(store.moveHistory()),
          type: 'tip',
          trigger: 'hint-request',
          instruction: `Le meilleur coup pour le joueur est d'aller de ${from} vers ${to}. Explique en une phrase simple pourquoi, sans donner d'autre coup.`,
          moveUci: best,
          fenBefore: fen,
        });
        const current = store.hint();
        patchState(store, {
          coaching,
          coachingLoading: false,
          hint: current ? { ...current, reason: coaching.text } : current,
        });
      },

      /** Dismiss the floating hint card (board arrow included). */
      clearHint(): void {
        patchState(store, { hint: null });
      },

      /**
       * Take back the last full move pair (bot reply + player move) and hand
       * the turn back to the player. Only meaningful while it's their turn.
       */
      undoMove(): void {
        if (store.phase() !== 'player-turn') return;
        const history = store.moveHistory();
        if (history.length < 2) return;

        const trimmed = history.slice(0, -2);
        const chess = new Chess();
        for (const m of trimmed) chess.move(uciToMove(m.uci));
        patchState(store, {
          currentFen: chess.fen(),
          moveHistory: trimmed,
          hint: null,
          coaching: {
            type: 'tip',
            text: 'Coup repris — cherche une meilleure idée !',
            triggeredBy: 'player-move',
          },
          coachingLoading: false,
          inCheck: chess.inCheck(),
          gameResult: null,
        });
      },
    };
  }),
);
