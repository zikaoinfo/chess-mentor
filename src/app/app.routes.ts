import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'ChessMentor — Entraînement',
    loadComponent: () =>
      import('./features/puzzle/pages/puzzle-trainer/puzzle-trainer').then(
        (m) => m.PuzzleTrainer,
      ),
  },
  {
    path: 'instructor',
    title: 'ChessMentor — Jouer contre le bot',
    loadComponent: () =>
      import('./features/instructor/pages/instructor-game/instructor-game').then(
        (m) => m.InstructorGame,
      ),
  },
  {
    path: 'online',
    title: 'ChessMentor — Jouer en ligne',
    loadComponent: () =>
      import('./features/online/pages/online-play/online-play').then((m) => m.OnlinePlay),
  },
  {
    path: 'rush',
    title: 'ChessMentor \u2014 Puzzle Rush',
    loadComponent: () =>
      import('./features/puzzle/pages/puzzle-rush/puzzle-rush').then((m) => m.PuzzleRush),
  },
  {
    path: 'review',
    title: 'ChessMentor — Analyse de partie',
    loadComponent: () =>
      import('./features/analysis/pages/game-review/game-review').then((m) => m.GameReviewPage),
  },
  {
    path: 'openings',
    title: 'ChessMentor — Explorateur d\u2019ouvertures',
    loadComponent: () =>
      import('./features/openings/pages/explorer/explorer').then((m) => m.OpeningsExplorer),
  },
  {
    path: 'drills',
    title: 'ChessMentor \u2014 Finales',
    loadComponent: () =>
      import('./features/drills/pages/endgame-trainer/endgame-trainer').then(
        (m) => m.EndgameTrainer,
      ),
  },
  {
    path: 'insights',
    title: 'ChessMentor — Insights',
    loadComponent: () =>
      import('./features/stats/pages/insights/insights').then((m) => m.Insights),
  },
  {
    path: 'stats',
    title: 'ChessMentor — Progression',
    loadComponent: () =>
      import('./features/stats/pages/dashboard/dashboard').then((m) => m.Dashboard),
  },
  { path: '**', redirectTo: '' },
];
