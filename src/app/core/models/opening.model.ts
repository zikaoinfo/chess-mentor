/** One candidate move from the Lichess opening explorer. */
export interface ExplorerMove {
  readonly uci: string;
  readonly san: string;
  readonly white: number;
  readonly draws: number;
  readonly black: number;
  readonly averageRating: number;
}

/** Response of `GET https://explorer.lichess.ovh/lichess?fen=…`. */
export interface ExplorerResponse {
  readonly white: number;
  readonly draws: number;
  readonly black: number;
  readonly moves: readonly ExplorerMove[];
  readonly opening: { readonly eco: string; readonly name: string } | null;
}

/** A line saved to the local repertoire. */
export interface RepertoireEntry {
  readonly id: string;
  readonly fen: string;
  /** SAN line from the start position, space-separated. */
  readonly line: string;
  readonly eco: string | null;
  readonly name: string | null;
  readonly addedAt: Date;
}
