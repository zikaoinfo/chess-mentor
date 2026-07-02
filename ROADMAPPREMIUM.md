# ChessMentor — Roadmap features "premium" (équivalents Chess.com gratuits)

> Objectif : reproduire les features payantes de Chess.com (Gold / Platinum / Diamond)
> gratuitement, avec Lichess API + Stockfish WASM + Claude API + stockage local.
> Respecter toutes les conventions du CLAUDE.md.
>
> **Claude Code doit cocher `[x]` chaque feature livrée et mettre à jour ce fichier.**

---

## Correspondance Chess.com → ChessMentor

| Feature premium Chess.com | Tier | Équivalent gratuit ChessMentor | Techno |
|---|---|---|---|
| Unlimited puzzles | Gold | Puzzles illimités | Lichess API (gratuit) |
| Unlimited lessons | Gold | Leçons interactives | Contenu statique + chess.js |
| No ads | Gold | Pas de pub par design | — |
| Unlimited Game Review | Platinum | Analyse de partie illimitée | Stockfish WASM |
| Opening Explorer | Platinum | Explorateur d'ouvertures | Lichess Opening API |
| Coach Explanations (AI) | Diamond | Coaching AI par coup | Claude API |
| Insights (stats de jeu) | Diamond | Dashboard d'insights | IndexedDB + computed |
| Puzzle Rush / Battle | Diamond | Mode puzzle chronométré | Lichess API + timer |
| Drills / Endgames | All | Entraînement finales | chess.js + positions |
| Bots à personnalités | Diamond | Bots à styles variés | Stockfish + presets |

---

## Feature 1 — Game Review (analyse de partie complète) `[x]` (2026-07-02)
> Équivalent : "Unlimited Game Review" (Platinum) + "Coach Explanations" (Diamond)

- `features/analysis/pages/game-review/`
- Rejouer n'importe quelle partie coup par coup (navigation avant/arrière)
- Pour chaque coup, Stockfish (depth 15) évalue et classe :
  `brilliant | best | good | inaccuracy | mistake | blunder`
- Barre d'évaluation verticale (avantage blanc/noir) mise à jour par coup
- Bouton "Expliquer ce coup" → Claude API génère l'explication en langage naturel
- Graphe de l'évaluation sur toute la partie (courbe centipawn)
- Résumé de fin : nombre de blunders/mistakes/inaccuracies par joueur
- Source des parties : historique local (IndexedDB) des parties Instructor

## Feature 2 — Opening Explorer `[ ]`
> Équivalent : "Opening Explorer" (Platinum)

- `features/openings/pages/explorer/`
- API Lichess : `GET https://explorer.lichess.ovh/lichess?fen={fen}`
- Afficher les coups les plus joués depuis la position courante avec % de victoire
- Nom de l'ouverture (ECO code) affiché en temps réel
- Cliquer un coup l'applique sur le board et continue l'exploration
- Bouton "Ajouter à mon répertoire" (sauvegarde locale IndexedDB)

## Feature 3 — Insights / Dashboard de statistiques `[ ]`
> Équivalent : "Insights" (Diamond)

- `features/stats/pages/insights/`
- Toutes les données depuis IndexedDB (parties + puzzles joués)
- Métriques : winrate global, winrate par couleur, précision moyenne,
  répartition des erreurs par phase (ouverture/milieu/finale)
- "Ta faiblesse principale" : phase où tu perds le plus de points (computed)
- Graphes : évolution du rating puzzle, précision dans le temps
- Thèmes de puzzles les plus ratés (ex : "tu rates 60% des fourchettes")

## Feature 4 — Puzzle Rush (mode chronométré) `[ ]`
> Équivalent : "Puzzle Rush / Puzzle Battle" (Diamond)

- `features/puzzle/pages/puzzle-rush/`
- Enchaîner un maximum de puzzles en 3 min (ou 5 min / survival)
- Difficulté progressive : chaque puzzle résolu augmente le rating cible
- 3 erreurs = fin de partie (mode survival)
- Score sauvegardé localement + record personnel
- Compteur de streak visuel en temps réel

## Feature 5 — Bots à personnalités `[ ]`
> Équivalent : "Unlimited Bots" (Diamond)

- Étendre l'Instructor existant avec des presets de bots
- Chaque bot = { nom, elo cible, style, avatar, phrase d'intro }
- Styles : agressif (favorise les captures), positionnel, défensif, hasardeux
- Le style module les paramètres Stockfish (Skill Level + contempt)
- Sélection du bot avant la partie dans un carrousel

## Feature 6 — Endgame Drills `[ ]`
> Équivalent : "Endgames / Drills" (all tiers)

- `features/drills/pages/endgame-trainer/`
- Positions de finales classiques (R+D vs R, R+T vs R, opposition des rois)
- Le joueur doit mater / promouvoir, Stockfish défend de façon optimale
- Feedback si le joueur s'éloigne de la solution (nombre de coups au mat)
- Progression par catégorie de finale

---

## Ordre de priorité recommandé

1. **Game Review** (Feature 1) — c'est LE feature qui accélère le plus la progression
2. **Insights** (Feature 3) — donne du sens aux données déjà collectées
3. **Opening Explorer** (Feature 2) — rapide à faire, API Lichess prête
4. **Puzzle Rush** (Feature 4) — réutilise le système de puzzles existant
5. **Bots à personnalités** (Feature 5) — extension légère de l'Instructor
6. **Endgame Drills** (Feature 6) — contenu à créer, plus long

---

## Règles de mise à jour de ce fichier

- Cocher `[x]` quand une feature est livrée ET que `npx ng build` passe
- Ajouter la date de livraison à côté : `Feature 1 — Game Review [x] (2026-07-15)`
- Si une feature est partiellement faite, noter ce qui reste sous la ligne
- Ne jamais supprimer une feature de la liste — l'historique reste visible
