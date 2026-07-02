/** Playing style of a bot persona — modulates the Stockfish parameters. */
export type BotStyle = 'agressif' | 'positionnel' | 'defensif' | 'hasardeux';

/** A bot personality preset for the Instructor. */
export interface BotPersona {
  readonly id: string;
  readonly name: string;
  readonly avatar: string; // emoji
  readonly elo: number; // displayed target strength
  readonly style: BotStyle;
  readonly intro: string; // greeting shown when the game starts
  /** Stockfish Skill Level (0–20). */
  readonly skill: number;
  /** UCI Contempt: positive = risk-taking, negative = draw-happy. */
  readonly contempt: number;
  /** Probability of playing a random legal move instead of the engine move. */
  readonly randomness: number;
  /** Probability of preferring a capture over a quiet engine move. */
  readonly captureBias: number;
}

export const BOT_PRESETS: readonly BotPersona[] = [
  {
    id: 'zaza',
    name: 'Zaza',
    avatar: '🎲',
    elo: 500,
    style: 'hasardeux',
    intro: 'Salut ! Je joue un peu au hasard… surprends-moi !',
    skill: 0,
    contempt: 0,
    randomness: 0.45,
    captureBias: 0,
  },
  {
    id: 'rex',
    name: 'Rex',
    avatar: '🦖',
    elo: 800,
    style: 'agressif',
    intro: 'RAAAH ! Je fonce dans le tas et je croque tout ce qui traîne.',
    skill: 3,
    contempt: 80,
    randomness: 0.05,
    captureBias: 0.5,
  },
  {
    id: 'carapace',
    name: 'Carapace',
    avatar: '🐢',
    elo: 900,
    style: 'defensif',
    intro: 'Doucement mais sûrement. Essaie donc de percer ma défense.',
    skill: 5,
    contempt: -60,
    randomness: 0.05,
    captureBias: 0,
  },
  {
    id: 'livia',
    name: 'Livia',
    avatar: '🌿',
    elo: 1100,
    style: 'positionnel',
    intro: 'Chaque pièce à sa place. Je construis, tu verras le résultat.',
    skill: 8,
    contempt: 0,
    randomness: 0,
    captureBias: 0,
  },
] as const;
