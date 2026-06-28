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
    path: 'stats',
    title: 'ChessMentor — Progression',
    loadComponent: () =>
      import('./features/stats/pages/dashboard/dashboard').then((m) => m.Dashboard),
  },
  { path: '**', redirectTo: '' },
];
