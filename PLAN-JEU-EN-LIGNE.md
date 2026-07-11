# Plan d'implémentation — Jeu en ligne pour ChessMentor
**Via l'API Board de Lichess**

---

## Vue d'ensemble

Ajouter le mode « Jouer en ligne » à ChessMentor en s'appuyant sur l'infrastructure Lichess (WebSocket, matchmaking, ELO) plutôt qu'un backend custom. Réutilise l'intégration Lichess déjà en place pour les puzzles.

---

## Phase 0 — Prérequis & authentification `[x]` (2026-07-11)
> Livré : PKCE pur frontend (`pkce.utils`, vecteur RFC 7636 testé). Lichess
> accepte les clients publics SANS enregistrement ni secret → pas besoin du
> proxy Cloudflare pour l'auth (les tokens PKCE Lichess sont longue durée,
> pas de refresh). Token stocké en IndexedDB via StorageService (store
> `settings`, DB v3) — jamais localStorage. `LichessAuthService` : login,
> callback (vérif state), compte, logout avec révocation serveur.
> Déviation : garde de route remplacée par un gate DANS la page (l'écran de
> connexion EST la page /online — une garde n'aurait fait qu'y rediriger).

### 0.1 — OAuth2 Lichess
L'API Board nécessite un token utilisateur avec les scopes `board:play`.

- Enregistrer l'app sur `lichess.org/account/oauth/app`
- Implémenter le flow OAuth2 PKCE (pas de client secret côté frontend)
- Stocker le token de façon sécurisée (le Cloudflare Worker proxy peut gérer le refresh)

### 0.2 — Service d'auth Angular
- `LichessAuthService` — gère login, token, refresh
- Guard sur les routes de jeu en ligne
- État d'auth dans le NgRx Signal Store

**Livrable :** un user peut se connecter avec son compte Lichess depuis ChessMentor.

---

## Phase 1 — Architecture & state `[x]` (2026-07-11)
> `OnlineGameStore` (signalStore root) : phase, gameId, myColor, fen, moves
> serveur, pendules + horodatage de synchro, statut, adversaire, offre de
> nulle, connexion, erreur. Modèles typés dans `core/models/online.model.ts`
> (gameFull/gameState/chatLine, événements compte, config). 6 tests store.

### 1.1 — Signal Store pour la partie en ligne
```
OnlineGameStore
├── gameState      (position FEN courante)
├── gameId         (id de la partie Lichess)
├── myColor        (white | black)
├── clock          (temps restant)
├── status         (created | started | finished)
├── opponent       (nom, ELO)
└── moves          (historique)
```

### 1.2 — Modèles TypeScript
- `LichessGameEvent` (types du stream : gameFull, gameState, chatLine)
- `OnlineGameConfig` (cadence, couleur, rated/casual)

**Livrable :** structure de données typée, prête à recevoir le stream.

---

## Phase 2 — Connexion au stream de jeu `[x]` (2026-07-11)
> `LichessBoardService.streamGame` : NDJSON via fetch + ReadableStream
> (déviation documentée : httpResource/HttpClient ne consomment pas un flux
> ligne-à-ligne maintenu ouvert ; les mutations restent sur HttpClient).
> Parser incrémental `splitNdjson` testé (lignes partielles, keep-alive).
> Reconnexion auto avec backoff 1s→8s ; resync garanti : Lichess renvoie un
> `gameFull` complet à chaque réouverture du flux.

### 2.1 — Service de streaming
`LichessBoardService` avec :
- `streamGame(gameId)` — ouvre le flux NDJSON `/api/board/game/stream/{gameId}`
- Parse les événements ligne par ligne (ReadableStream)
- Push les updates dans le Signal Store

### 2.2 — Gestion de la reconnexion
- Retry automatique si le stream coupe
- Resync de l'état à la reconnexion

**Livrable :** ChessMentor reçoit les moves de l'adversaire en temps réel.

---

## Phase 3 — Envoi des coups `[x]` (2026-07-11)
> POST /move/{uci} (promotion comprise — le sélecteur ♕♖♗♘ du board émet
> l'UCI complet). Optimiste : coup appliqué localement (validation chess.js),
> le stream confirme ; en cas de refus serveur → `revertToServer()` (retour
> aux coups confirmés) + message d'erreur.

### 3.1 — Jouer un coup
- `makeMove(gameId, move)` → `POST /api/board/game/{gameId}/move/{move}`
- Format UCI (ex. `e2e4`, `e7e8q` pour promotion)
- Validation locale avant envoi (chess.js) pour un feedback instantané

### 3.2 — Synchronisation optimiste
- Appliquer le coup localement immédiatement
- Confirmer/rollback selon la réponse du stream

**Livrable :** boucle de jeu complète — les deux joueurs jouent en temps réel.

---

## Phase 4 — Création & matchmaking `[x]` (2026-07-11)
> Seek (requête maintenue OUVERTE — particularité de /api/board/seek —
> annulée via AbortController au gameStart), défi à un pseudo, défi ouvert
> avec lien partageable + copie + annulation. Détection du départ de partie
> par le stream de compte /api/stream/event. Écran de config : cadences
> 10+0/10+5/15+10/30+0 (l'API Board exige rapide ou plus lent en temps
> réel), classée/amicale, couleur (hors seek classé, imposé par Lichess).

### 4.1 — Partie contre un ami (challenge)
- `POST /api/challenge/{username}` — défier un joueur précis
- `POST /api/challenge/open` — créer un lien partageable
- Écran d'attente pendant que l'adversaire rejoint

### 4.2 — Matchmaking automatique (seek)
- `POST /api/board/seek` — chercher un adversaire au hasard selon la cadence
- Écran « Recherche d'un adversaire… »

### 4.3 — Écran de configuration
- Choix de la cadence (blitz 5+0, rapid 10+0, etc.)
- Rated ou casual
- Couleur (aléatoire / blanc / noir)

**Livrable :** un user peut lancer une partie contre un ami ou un inconnu.

---

## Phase 5 — Contrôles de partie `[x]` (2026-07-11)
> Abandon (avec confirmation), nulle : proposer / accepter / refuser (bannière
> quand l'adversaire propose). Pendules : décompte local 200ms du côté au
> trait, resynchronisé sur wtime/btime à chaque gameState ; alerte < 30s.

### 5.1 — Actions en jeu
- Abandonner (`POST /api/board/game/{gameId}/resign`)
- Proposer nulle (`POST /api/board/game/{gameId}/draw/yes`)
- Prendre le temps (gestion de l'horloge)

### 5.2 — Horloge
- Affichage temps réel des deux pendules
- Décompte local synchronisé avec le stream

**Livrable :** partie complète avec pendule, abandon et nulle.

---

## Phase 6 — UI/UX & intégration `[x]` (2026-07-11)
> Échiquier existant réutilisé (drag tactile, promotion, échec) + barres de
> captures et avantage matériel. Infos adversaire (nom, ELO), indicateur de
> connexion (point vert / reconnexion), historique SAN. Entrée de nav
> « En ligne », route lazy loadComponent (équivalent moderne de @defer au
> niveau route). Hors-ligne : actions désactivées + bandeau. Post-partie :
> sauvegarde en SavedGame local → « Analyser la partie → » ouvre l'analyse
> Stockfish existante (auto-lancée).

### 6.1 — Écran de jeu en ligne
- Réutiliser le composant échiquier existant
- Ajouter : infos adversaire, horloges, boutons d'action
- Indicateur de connexion (stream actif / coupé)

### 6.2 — Navigation
- Nouvelle entrée de menu « Jouer en ligne »
- Route lazy-loaded avec `@defer`
- Guard d'authentification Lichess

### 6.3 — Historique post-partie
- Récupérer la PGN de la partie terminée
- Proposer l'analyse Stockfish existante de ChessMentor sur cette partie

**Livrable :** feature complète, intégrée au reste de l'app.

---

## Phase 7 — Tests & polish `[x]` (2026-07-11)
> 18 tests unitaires (PKCE vecteur RFC, parser NDJSON, rejeu UCI→SAN/FEN,
> corps seek/challenge, formats d'horloge, libellés de résultat, store :
> couleurs, tours, optimisme/rollback, offre de nulle, fin) — 117 au total.
> E2E navigateur avec Lichess intégralement simulé : login → seek →
> gameStart → gameFull → coup optimiste POSTé → écho serveur → offre de
> nulle refusée → victoire par abandon → analyse auto. 0 erreur console.
> LIMITE : lichess.org est inaccessible depuis l'environnement de dev
> (proxy) — OAuth réel et première partie réelle à valider en production.

- Tests unitaires des services (auth, stream, moves)
- Gestion des cas limites (déconnexion, timeout, partie abandonnée par l'adversaire)
- États d'erreur clairs (token expiré, adversaire parti)
- Test PWA hors-ligne (désactiver proprement le mode en ligne sans réseau)

---

## Récapitulatif des endpoints Lichess

| Action | Endpoint |
|---|---|
| Stream partie | `GET /api/board/game/stream/{gameId}` |
| Jouer un coup | `POST /api/board/game/{gameId}/move/{move}` |
| Chercher adversaire | `POST /api/board/seek` |
| Défier un ami | `POST /api/challenge/{username}` |
| Partie ouverte | `POST /api/challenge/open` |
| Abandonner | `POST /api/board/game/{gameId}/resign` |
| Proposer nulle | `POST /api/board/game/{gameId}/draw/yes` |

---

## Estimation d'effort

| Phase | Complexité | Durée estimée |
|---|---|---|
| 0 — Auth OAuth2 | Moyenne | 1–2 jours |
| 1 — Architecture | Faible | 0,5 jour |
| 2 — Stream | Moyenne | 1 jour |
| 3 — Envoi coups | Faible | 0,5 jour |
| 4 — Matchmaking | Moyenne | 1–2 jours |
| 5 — Contrôles | Faible | 1 jour |
| 6 — UI/UX | Moyenne | 2 jours |
| 7 — Tests | Moyenne | 1–2 jours |
| **Total** | | **~8–11 jours** |

---

## Points d'attention

- **Rate limits Lichess** : respecter les limites (429 → backoff). L'API Board est plus permissive que l'API Bot mais reste limitée.
- **Un seul token = un seul joueur** : chaque user joue avec SON compte Lichess. ChessMentor ne peut pas jouer « à la place » de deux joueurs.
- **PWA hors-ligne** : le jeu en ligne nécessite une connexion — désactiver proprement le bouton en mode offline.
- **Alternative future** : si tu veux ton propre système de rating/matchmaking indépendant de Lichess, prévoir un backend Cloudflare Durable Objects (Phase 8, hors scope actuel).
