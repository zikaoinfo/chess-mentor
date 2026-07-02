import { Difficulty, GameResult, InstructorMove } from './instructor.model';
import { GameReview } from './analysis.model';

/** A finished Instructor game, persisted locally for Game Review & Insights. */
export interface SavedGame {
  readonly id: string;
  readonly playedAt: Date;
  readonly playerColor: 'white' | 'black';
  readonly difficulty: Difficulty;
  readonly result: GameResult | null;
  readonly moves: readonly InstructorMove[];
  /** Bot persona the game was played against, when applicable. */
  readonly botName?: string;
  /** Attached once the game has been analysed. */
  readonly review?: GameReview;
}
