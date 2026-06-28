# ChessMentor

Application Angular 22 d'apprentissage des échecs — puzzles tactiques, feedback
immédiat et suivi de progression. Les puzzles proviennent de l'API Lichess et
sont résolus sur un échiquier SVG entièrement maison.

> Déployée sur GitHub Pages : `https://<username>.github.io/chess-mentor/`

## Stack

| Outil | Version | Rôle |
|---|---|---|
| Angular | 22.x | Standalone, zoneless, OnPush, signals |
| TypeScript | 5.9.x | `strict` activé |
| NgRx Signals | 19.x | `signalStore` + `withEntities` pour l'état partagé |
| chess.js | 1.x | Logique des règles uniquement (légalité, UCI, mat) |
| Vitest | inclus | Runner de test par défaut d'Angular 22 |

## Architecture

```
src/app/
├── core/          # models, services (httpResource + IndexedDB), store, tokens
├── features/
│   ├── board/     # échiquier SVG + utils FEN / moteur de coups (chess.js)
│   ├── puzzle/    # carte de puzzle, panneau de feedback, page d'entraînement
│   └── stats/     # tableau de bord de progression
└── shared/        # streak-badge, pipe de libellés de thèmes
```

Points clés :

- **Zoneless** — `provideZonelessChangeDetection()`, aucun `zone.js`.
- **httpResource** pour les lectures de l'API Lichess (loading/error/value gérés).
- **NgRx Signal Store** (`PuzzleStore`) pour la session de résolution et le
  journal des tentatives (entités persistées via `StorageService` → IndexedDB).
- **FEN = source unique de vérité** ; les coups circulent en UCI.
- L'URL de l'API Lichess est injectée via le token `LICHESS_API_URL`.

## Développement

```bash
npm install
npm start            # ng serve
npm test             # ng test --watch=false (Vitest)
npm run build:prod   # build production + base-href /chess-mentor/
```

## Déploiement

Le workflow `.github/workflows/deploy.yml` construit, teste, puis publie sur
GitHub Pages à chaque push sur `main`. `index.html` est copié en `404.html`
pour le routage SPA.

## Conventions

Les règles de code détaillées (Angular 22, signals, état, tests) sont dans
[`CLAUDE.md`](./CLAUDE.md).
