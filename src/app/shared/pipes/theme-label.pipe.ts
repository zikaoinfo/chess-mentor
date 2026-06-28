import { Pipe, PipeTransform } from '@angular/core';

/** Human-readable French labels for Lichess theme ids. */
const THEME_LABELS: Readonly<Record<string, string>> = {
  mix: 'Tous thèmes',
  fork: 'Fourchette',
  pin: 'Clouage',
  skewer: 'Enfilade',
  mateIn1: 'Mat en 1',
  mateIn2: 'Mat en 2',
  mateIn3: 'Mat en 3',
  mate: 'Mat',
  endgame: 'Finale',
  middlegame: 'Milieu de jeu',
  opening: 'Ouverture',
  discoveredAttack: 'Attaque à la découverte',
  hangingPiece: 'Pièce en prise',
  advantage: 'Avantage',
  crushing: 'Position gagnante',
  short: 'Courte',
  long: 'Longue',
};

/**
 * Translate a raw Lichess theme id into a display label.
 * Unknown ids are spaced/capitalised as a sensible fallback
 * (`'doubleCheck'` → `'Double Check'`).
 */
@Pipe({ name: 'themeLabel' })
export class ThemeLabelPipe implements PipeTransform {
  transform(theme: string | null | undefined): string {
    if (!theme) return '';
    return THEME_LABELS[theme] ?? humanise(theme);
  }
}

function humanise(theme: string): string {
  const spaced = theme.replace(/([A-Z])/g, ' $1').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
