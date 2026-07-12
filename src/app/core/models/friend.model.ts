/**
 * Un adversaire déjà rencontré en ligne (défié ou joué). Mémorisé localement
 * pour proposer des raccourcis « rejouer contre » — ChessMentor ne stocke
 * jamais la liste d'amis Lichess elle-même, seulement les pseudos croisés ici.
 */
export interface Friend {
  /** Pseudo Lichess, casse d'origine (la clé de stockage est en minuscules). */
  readonly name: string;
  /** Clé de déduplication : `name.toLowerCase()`. */
  readonly id: string;
  /** Dernière partie/défi avec ce joueur. */
  readonly lastPlayedAt: Date;
  /** Nombre de parties/défis lancés avec lui depuis ChessMentor. */
  readonly games: number;
}
