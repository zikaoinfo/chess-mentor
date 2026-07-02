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
    path: 'review',
    title: 'ChessMentor — Analyse de partie',
    loadComponent: () =>
      import('./features/analysis/pages/game-review/game-review').then((m) => m.GameReviewPage),
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
