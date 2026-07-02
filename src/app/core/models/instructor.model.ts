/**
 * Domain types for the Bot Instructor feature: play a full game against a
 * Stockfish-powered bot with real-time, Claude-generated coaching.
 */

/** Bot strength tiers (≈ 0–1200 Elo). */
export type Difficulty = 'beginner' | 'easy' | 'medium';

/** Outcome of a finished coached game. */
export type GameResult = 'white-wins' | 'black-wins' | 'draw';

/** Lifecycle of a coached game. */
export type InstructorPhase =
  | 'idle'
  | 'player-turn'
  | 'bot-thinking'
  | 'bot-moved'
  | 'game-over';

/** A single move played in the coached game. */
export interface InstructorMove {
  readonly uci: string; // 'e2e4'
  readonly san: string; // 'e4'
  readonly by: 'player' | 'bot';
  readonly explanation?: string; // only for bot moves
}

/** A directional arrow drawn on the board. */
export interface Arrow {
  readonly from: string; // 'e2'
  readonly to: string; // 'e4'
}

/**
 * A pending hint surfaced on the board + panel. `to`/`arrows` are optional:
 * the puzzle trainer only reveals the origin square, while the instructor
 * shows the full move with an arrow.
 */
export interface HintState {
  readonly from: string; // origin square 'e2'
  readonly to?: string; // destination square 'e4'
  readonly reason: string; // short natural-language explanation
  readonly arrows?: readonly Arrow[]; // arrows to draw on the board
}

export type CoachingType = 'praise' | 'warning' | 'tip' | 'explanation';
export type CoachingTrigger = 'player-move' | 'bot-move' | 'hint-request' | 'game-review';

/** A coaching bubble shown in the side panel. */
export interface CoachingMessage {
  readonly type: CoachingType;
  readonly text: string;
  readonly triggeredBy: CoachingTrigger;
}

/** Shape of the Anthropic Messages API response we consume. */
export interface AnthropicMessageResponse {
  readonly content: ReadonlyArray<{ readonly type: string; readonly text?: string }>;
}
