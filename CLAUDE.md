# ChessMentor — Conventions Claude Code

## Projet
Application Angular 22 d'apprentissage des échecs (puzzles, feedback, progression).
Déployée sur GitHub Pages : https://<username>.github.io/chess-mentor/

---

## Stack & versions

| Outil | Version | Notes |
|---|---|---|
| Angular | 22.x | Standalone, zoneless, selectorless, OnPush par défaut |
| TypeScript | 5.9.x | strict mode obligatoire |
| NgRx Signals | 19.x | `signalStore`, `withEntities`, `patchState` |
| chess.js | 1.x | Logique des règles uniquement |
| Vitest | default | Runner de test par défaut depuis Angular 22 |

---

## Règles absolues (ne jamais enfreindre)

### Angular 22 — nouveautés stables à utiliser

- **Zoneless par défaut** — `provideZonelessChangeDetection()` dans `app.config.ts` (plus d'API "experimental")
- **`OnPush` par défaut** — Angular 22 l'applique automatiquement sur les nouveaux composants, ne pas revenir à `Default`
- **Selectorless components** — importer les composants directement dans les templates sans string selector
- **`httpResource()` stable** — utiliser pour tous les appels HTTP en lecture (plus `HttpClient` + `toSignal()`)
- **`rxResource()` stable** — pour les ressources RxJS-based si besoin
- **Signal Forms stable** — utiliser à la place de `ReactiveFormsModule` pour tous les nouveaux formulaires
- **`injectAsync()` (Developer Preview)** — pour le lazy-loading de services si besoin

### Ce qui ne change pas

- **Pas de `NgModules`** — uniquement standalone components/pipes/directives
- **Pas d'`effect()`** pour la dérivation d'état — utiliser `computed()` exclusivement
- **Pas d'injection en dehors du contexte d'injection** — pas de `inject()` dans des callbacks
- **`input()` / `output()`** signals API (pas `@Input()` / `@Output()` décorateurs)
- **`toSignal()`** pour convertir les Observables en signals dans les composants

### État
- **NgRx Signal Store** pour tout état partagé (`signalStore`, `withEntities`, `patchState`)
- **Signals locaux** (`signal()`, `computed()`, `linkedSignal()`) pour l'état interne
- **`linkedSignal()`** — utiliser pour les signals qui doivent se réinitialiser quand un autre signal change
- **`debounced()` signal** — pour les inputs de recherche/filtre avec délai
- **Pas de `BehaviorSubject`** ni de `ReplaySubject` pour l'état

### HTTP (Angular 22)
- **`httpResource()`** pour tous les appels en lecture — gère loading/error/success automatiquement
- **`HttpClient`** avec `inject()` uniquement pour les mutations (POST, PUT, DELETE)
- **`provideHttpClient(withFetch())`** dans `app.config.ts`
- Toujours typer les réponses API — jamais de `any`

### Tests
- **Vitest** — runner par défaut dans Angular 22, pas de Karma
- Pas besoin de configurer quoi que ce soit, Vitest est inclus out of the box
- Fichiers de test : `*.spec.ts` dans le même dossier que le fichier testé

### TypeScript
- **`strict: true`** — pas de contournement
- **Pas de `as any`** ni de `// @ts-ignore`
- Préférer les types utilitaires (`Readonly<>`, `Pick<>`) aux interfaces dupliquées
- Les modèles dans `core/models/` — un fichier par entité

---

## Structure du projet

```
src/
├── app/
│   ├── core/
│   │   ├── models/
│   │   │   ├── puzzle.model.ts       # LichessPuzzle, PuzzleAttempt
│   │   │   └── game-state.model.ts   # GameState, MoveResult
│   │   ├── services/
│   │   │   ├── puzzle.service.ts     # httpResource vers Lichess API
│   │   │   └── storage.service.ts    # IndexedDB abstraction
│   │   └── store/
│   │       └── puzzle.store.ts       # NgRx Signal Store global
│   ├── features/
│   │   ├── board/
│   │   │   ├── components/
│   │   │   │   └── chessboard/       # échiquier SVG interactif (selectorless)
│   │   │   └── utils/
│   │   │       └── fen.utils.ts      # parsing FEN → positions
│   │   ├── puzzle/
│   │   │   ├── components/
│   │   │   │   ├── puzzle-card/      # carte du puzzle actuel
│   │   │   │   └── feedback-panel/   # ✓/✗ + explication
│   │   │   └── pages/
│   │   │       └── puzzle-trainer/   # page principale
│   │   └── stats/
│   │       └── pages/
│   │           └── dashboard/        # progression & graphes (phase 2)
│   ├── shared/
│   │   ├── components/
│   │   │   └── streak-badge/
│   │   └── pipes/
│   │       └── theme-label.pipe.ts   # 'fork' → 'Fourchette'
│   ├── app.routes.ts
│   └── app.config.ts                 # provideZonelessChangeDetection, httpResource
├── styles/
│   ├── main.scss
│   ├── _tokens.scss
│   └── _board.scss
└── index.html
```

---

## app.config.ts de référence (Angular 22)

```typescript
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),   // pas de zone.js
    provideRouter(routes),
    provideHttpClient(withFetch()),
  ],
};
```

---

## Modèles principaux

```typescript
// core/models/puzzle.model.ts
export interface LichessPuzzle {
  readonly id: string;
  readonly rating: number;
  readonly themes: readonly string[];
  readonly solution: readonly string[];   // coups UCI : 'e2e4'
  readonly fen: string;
}

export interface PuzzleAttempt {
  readonly puzzleId: string;
  readonly solvedAt: Date;
  readonly attempts: number;
  readonly timeMs: number;
  readonly correct: boolean;
}
```

---

## httpResource — pattern de référence (Angular 22)

```typescript
// core/services/puzzle.service.ts
import { Injectable, inject } from '@angular/core';
import { httpResource } from '@angular/core';
import { LICHESS_API_URL } from '../tokens/api.tokens';

@Injectable({ providedIn: 'root' })
export class PuzzleService {
  private readonly apiUrl = inject(LICHESS_API_URL);

  // httpResource gère loading / error / value automatiquement
  readonly nextPuzzle = httpResource<LichessApiResponse>(
    () => `${this.apiUrl}/puzzle/next`
  );

  puzzleByTheme(theme: Signal<string>) {
    return httpResource<LichessApiResponse>(
      () => `${this.apiUrl}/puzzle/next?angle=${theme()}`
    );
  }
}
```

---

## API Lichess

```
GET https://lichess.org/api/puzzle/next
GET https://lichess.org/api/puzzle/next?angle=fork
GET https://lichess.org/api/puzzle/next?angle=pin
GET https://lichess.org/api/puzzle/next?angle=mateIn1
GET https://lichess.org/api/puzzle/next?angle=mateIn2

# Le filtre de thème passe par le paramètre `angle` (PAS `themes`, que
# l'API ignore silencieusement → puzzle aléatoire).
# Pas d'auth requise · Rate limit : 30 req/min par IP
```

---

## Échiquier SVG

- **Pas de librairie externe** pour le rendu — SVG pur avec Angular
- Pièces en SVG inline (assets/pieces/)
- chess.js gère UNIQUEMENT la logique : validation, échec/mat, UCI
- Le drag & drop via directives Angular custom
- Position = FEN string, source unique de vérité

---

## GitHub Pages

- **`base-href` obligatoire** : `/chess-mentor/`
- Build : `ng build --configuration production --base-href /chess-mentor/`
- `404.html` = copie de `index.html` (SPA routing)
- Pas de SSR, pas de prerender

---

## Ce que Claude Code ne doit PAS faire

- Ajouter `zone.js` dans les polyfills ou `angular.json`
- Créer des NgModules
- Utiliser `@Input()` / `@Output()` décorateurs
- Utiliser `effect()` pour dériver de l'état
- Utiliser `ReactiveFormsModule` ou `FormsModule` pour les nouveaux formulaires
- Importer une librairie de board externe (chessboard.js, cm-chessboard...)
- Utiliser `localStorage` directement — passer par `StorageService`
- Hard-coder l'URL Lichess sans `InjectionToken`
- Utiliser Karma — le runner de test est Vitest
