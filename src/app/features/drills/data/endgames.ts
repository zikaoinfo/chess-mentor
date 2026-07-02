import { EndgameDrill } from '../../../core/models/drill.model';

/**
 * Classic endgame drills. The player always has White and the winning side;
 * Stockfish (full strength) defends. Positions are theoretical wins.
 */
export const DRILLS: readonly EndgameDrill[] = [
  {
    id: 'kq-k-1',
    category: 'Dame contre roi',
    label: 'Mat Dame + Roi (roi centré)',
    fen: '8/8/8/4k3/8/8/4Q3/4K3 w - - 0 1',
    goal: 'mate',
  },
  {
    id: 'kq-k-2',
    category: 'Dame contre roi',
    label: 'Mat Dame + Roi (roi au bord)',
    fen: '3k4/8/8/8/8/8/8/3QK3 w - - 0 1',
    goal: 'mate',
  },
  {
    id: 'kr-k-1',
    category: 'Tour contre roi',
    label: 'Mat Tour + Roi (roi centré)',
    fen: '8/8/8/4k3/8/8/4R3/4K3 w - - 0 1',
    goal: 'mate',
  },
  {
    id: 'kr-k-2',
    category: 'Tour contre roi',
    label: 'Mat Tour + Roi (roi repoussé)',
    fen: '3k4/8/8/8/8/8/8/2R1K3 w - - 0 1',
    goal: 'mate',
  },
  {
    id: 'kp-k-1',
    category: 'Opposition des rois',
    label: 'Pion + opposition (colonne e)',
    fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
    goal: 'promote',
  },
  {
    id: 'kp-k-2',
    category: 'Opposition des rois',
    label: 'Pion + opposition (colonne d)',
    fen: '3k4/8/3K4/3P4/8/8/8/8 w - - 0 1',
    goal: 'promote',
  },
  {
    id: 'lucena-1',
    category: 'Tour et pion',
    label: 'Position de Lucena (le pont)',
    // Win by building the bridge: Rc4, king out via c7/c8, rook shields checks.
    fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1',
    goal: 'promote',
  },
  {
    id: 'heavy-1',
    category: 'Pièces lourdes',
    label: 'Mat des deux tours (escalier)',
    fen: '4k3/8/8/8/8/8/R6R/4K3 w - - 0 1',
    goal: 'mate',
  },
  {
    id: 'heavy-2',
    category: 'Pièces lourdes',
    label: 'Mat Dame + Tour',
    fen: '3k4/8/8/8/8/8/Q6R/4K3 w - - 0 1',
    goal: 'mate',
  },
] as const;
