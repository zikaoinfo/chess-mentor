/** A classic endgame drill position. The player has the winning side. */
export interface EndgameDrill {
  readonly id: string;
  readonly category: string;
  readonly label: string;
  /** Position to win from — the player is always the side to move. */
  readonly fen: string;
  readonly goal: 'mate' | 'promote';
}

/** Local completion record for a drill. */
export interface DrillProgress {
  readonly id: string;
  readonly category: string;
  readonly completedAt: Date;
}
