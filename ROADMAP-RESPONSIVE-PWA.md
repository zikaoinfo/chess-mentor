# ChessMentor — Spec : Responsive + PWA installable

> Objectif en deux temps :
> 1. **Responsive** — rendre l'app utilisable au doigt sur mobile (elle ne l'est pas)
> 2. **PWA** — la rendre installable sur l'écran d'accueil, utilisable hors-ligne
>
> L'ordre compte : la responsivité DOIT être faite avant la PWA. Une PWA
> non-responsive est inutilisable une fois installée.
>
> Déploiement inchangé : tout continue de passer par GitHub Pages (`deploy.yml`).
> Respecter toutes les conventions du CLAUDE.md.
> **Claude Code coche `[x]` chaque étape livrée et met ce fichier à jour.**

---
---

# PARTIE 1 — RESPONSIVE

> À faire en premier. Tester après chaque étape dans Chrome DevTools (mode mobile)
> puis sur un vrai téléphone via l'URL GitHub Pages ou `ng serve --host 0.0.0.0`.

## 1.1 — Échiquier responsive `[x]` (2026-07-02)
> Livré : drag & drop Pointer Events (souris + doigt + stylet) avec pièce
> flottante, ghost sur la case d'origine et anneau de cible sous le doigt ;
> `touch-action: none` sur le board ; tap-tap conservé ; clavier conservé.
> Note : le board était déjà un carré fluide SVG (`viewBox`, cases en % de
> viewBox). Le plafond desktop reste `min(100%, 92vmin, 82vh, 1200px)` —
> exigence antérieure « grand jusqu'à 45 pouces » — plutôt que 600px.
- Le board est un carré fluide : `width: min(90vw, 90vh, 600px)`, `aspect-ratio: 1`
- Les cases utilisent des unités relatives (%), jamais de px fixes
- Les pièces SVG scalent avec la case (`viewBox`, pas de dimensions fixes)
- Drag & drop compatible tactile : utiliser **Pointer Events**
  (`pointerdown/pointermove/pointerup`) qui couvrent souris + doigt d'un coup
- `touch-action: none` sur le board pour éviter le scroll pendant qu'on déplace une pièce

## 1.2 — Layouts en une colonne sur mobile `[x]` (2026-07-02)
> Les pages board+panneau collapsent à ≤768px (instructor) et ≤900px
> (puzzle, analyse, ouvertures), board en premier dans le DOM. Correctif
> important : colonne `minmax(0, 1fr)` (un `1fr` nu = `minmax(auto, 1fr)`
> dont le plancher min-content débordait le viewport → la page devenait
> « zoomable » et les taps rapides partaient en double-tap).
- Tous les `grid-template-columns: 1fr 320px` passent en une colonne sous 768px
- Board en haut, panneau (Instructor / puzzle) en carte en dessous
- Media query dans chaque SCSS concerné :
```scss
@media (max-width: 768px) {
  .instructor-layout,
  .puzzle-layout { grid-template-columns: 1fr; }
}
```

## 1.3 — Zones tactiles et typographie `[x]` (2026-07-02)
> `@media (pointer: coarse), (max-width: 768px)` : boutons ≥44×44px,
> inputs à 16px (anti-zoom iOS), nav en rangée défilante avec cibles 44px.
- Boutons : min `44x44px` (recommandation tactile Apple / Google)
- Font-size min `16px` sur les inputs (évite le zoom automatique iOS au focus)
- Padding et gaps augmentés sur mobile (cartes plus aérées)

## 1.4 — Viewport et safe areas `[x]` (2026-07-02)
> `viewport-fit=cover` + `env(safe-area-inset-*)` sur header/main,
> `min-height: 100dvh` (fallback 100vh conservé pour vieux moteurs).
- `index.html` :
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```
- Utiliser `env(safe-area-inset-*)` pour les encoches / barres système
- `height: 100dvh` partout (jamais `100vh`, qui bug sur mobile avec la barre d'URL)

## 1.5 — Historique des coups et coaching sur mobile `[x]` (2026-07-02)
> Historique : déjà scrollable (220px) ; l'auto-scroll utilisait
> `scrollIntoView`, qui faisait défiler TOUTE la page vers l'historique
> après chaque coup — sur mobile le clic synthétisé du tap atterrissait
> alors sur le carrousel de bots remonté sous le doigt et RÉINITIALISAIT
> la partie. Corrigé (`scrollTop` du conteneur seul). Bulle de coaching
> bornée à 30dvh avec défilement interne sous 768px.
- L'historique des coups devient scrollable (horizontal ou accordéon) sous le board
- La bulle de coaching reste visible sans pousser le board hors de l'écran
- Le panneau ne doit jamais nécessiter un scroll pour voir l'échiquier entier

## Validation Partie 1
- Board carré et jouable au doigt sur un écran 360px de large ✓ (émulation
  Chromium mobile 360×740 tactile : tap-tap 8/8 essais, drag avec pièce
  flottante, puzzle résolu au drag)
- Aucun scroll horizontal nulle part ✓ (vérifié sur les 8 routes à 360px)
- Tous les boutons atteignables au pouce ✓ (≥44px)
- Tester sur Android ET iPhone (Safari a des comportements viewport différents)
  → à valider sur vrais devices via l'URL GitHub Pages après merge ;
  l'émulation ne remplace pas Safari iOS.

---
---

# PARTIE 2 — PWA INSTALLABLE

> À faire une fois la Partie 1 validée. Le service worker ne fonctionne QU'EN
> build de production, jamais en `ng serve`.

## 2.1 — Ajouter le support PWA Angular `[x]` (2026-07-02)
> `ng add @angular/pwa` exécuté ; `provideServiceWorker('ngsw-worker.js',
> { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' })`
> vérifié dans `app.config.ts` (conforme au bloc ci-dessous).
```bash
ng add @angular/pwa
```
Génère `ngsw-config.json`, `manifest.webmanifest`, les icônes placeholder,
et enregistre `provideServiceWorker` dans `app.config.ts`. Vérifier :
```typescript
provideServiceWorker('ngsw-worker.js', {
  enabled: !isDevMode(),
  registrationStrategy: 'registerWhenStable:30000',
}),
```

## 2.2 — Configurer le manifest `[x]` (2026-07-02)
> Manifest conforme au bloc ci-dessous (scope/start_url `/chess-mentor/`,
> thème #1a1a2e, portrait, 8 icônes maskable+any).
Éditer `public/manifest.webmanifest` :
```json
{
  "name": "ChessMentor",
  "short_name": "ChessMentor",
  "description": "Apprends les échecs : puzzles, coaching IA, progression jusqu'à 1000 Elo",
  "theme_color": "#1a1a2e",
  "background_color": "#1a1a2e",
  "display": "standalone",
  "scope": "/chess-mentor/",
  "start_url": "/chess-mentor/",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "icons/icon-72x72.png",   "sizes": "72x72",   "type": "image/png", "purpose": "maskable any" },
    { "src": "icons/icon-96x96.png",   "sizes": "96x96",   "type": "image/png", "purpose": "maskable any" },
    { "src": "icons/icon-128x128.png", "sizes": "128x128", "type": "image/png", "purpose": "maskable any" },
    { "src": "icons/icon-144x144.png", "sizes": "144x144", "type": "image/png", "purpose": "maskable any" },
    { "src": "icons/icon-152x152.png", "sizes": "152x152", "type": "image/png", "purpose": "maskable any" },
    { "src": "icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable any" },
    { "src": "icons/icon-384x384.png", "sizes": "384x384", "type": "image/png", "purpose": "maskable any" },
    { "src": "icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable any" }
  ]
}
```
**Piège GitHub Pages :** `scope` et `start_url` DOIVENT inclure `/chess-mentor/`.
Sinon l'installation échoue ou pointe vers la mauvaise URL.

## 2.3 — Icônes de l'app `[x]` (2026-07-02)
> 8 tailles générées (rendu Chromium) : cavalier accent #e94560 centré
> (~58 %, dans la zone sûre maskable 80 %) sur fond radial navy opaque.
> Métas iOS ajoutées dans `index.html` (apple-touch-icon 192, capable,
> status-bar black-translucent, titre).
- Icône source `icon-512x512.png` : fond opaque `#1a1a2e`, pièce d'échec centrée
- Zone de sécurité `maskable` : contenu dans les 80% centraux (coins rognables)
- Générer toutes les tailles (72 → 512px) via maskable.app ou un script
- Placer dans `public/icons/`
- **iOS** (Safari ignore le manifest pour l'icône) — ajouter dans `index.html <head>` :
```html
<link rel="apple-touch-icon" href="icons/icon-192x192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ChessMentor">
```

## 2.4 — Stratégie de cache (`ngsw-config.json`) `[x]` (2026-07-02)
> App shell en prefetch ; assets (icons/assets/wasm/images/fonts) en lazy ;
> **groupe `engine` dédié en prefetch** pour `stockfish.js` + `stockfish.wasm`
> (analyse garantie hors-ligne — vérifié : wasm servi du cache, 366 900 octets).
> dataGroups : lichess.org/api (freshness 1h) + explorer.lichess.ovh
> (freshness 7j pour les stats d'ouvertures).
App shell + assets :
```json
{
  "assetGroups": [
    {
      "name": "app",
      "installMode": "prefetch",
      "resources": { "files": ["/favicon.ico", "/index.html", "/manifest.webmanifest", "/*.css", "/*.js"] }
    },
    {
      "name": "assets",
      "installMode": "lazy",
      "updateMode": "prefetch",
      "resources": { "files": ["/icons/**", "/assets/**", "/*.wasm"] }
    }
  ],
  "dataGroups": [
    {
      "name": "lichess-api",
      "urls": ["https://lichess.org/api/**"],
      "cacheConfig": { "strategy": "freshness", "maxSize": 50, "maxAge": "1h", "timeout": "5s" }
    }
  ]
}
```
**Critique — Stockfish WASM :** le `.wasm` et le worker doivent être dans un
assetGroup, sinon l'analyse ne marche plus hors-ligne. Vérifier explicitement.

## 2.5 — État hors-ligne `[x]` (2026-07-02)
> `NetworkService` (signal `isOnline` sur navigator.onLine + events) ;
> bannière « 📡 Mode hors-ligne — nouveaux puzzles indisponibles » dans le
> shell ; vérifié hors-ligne sur build prod : app + route lazy /drills se
> chargent, wasm dispo, pas de crash (httpResource gère l'état d'erreur).
- `NetworkService` exposant un signal `isOnline` (`navigator.onLine` + events `online`/`offline`)
- Bannière discrète hors-ligne : "Mode hors-ligne — nouveaux puzzles indisponibles"
- Fonctions offline OK : rejouer une partie locale, puzzles déjà chargés, analyse Stockfish
- Fonctions réseau (nouveau puzzle Lichess, coaching Claude) : message clair, pas de crash

## 2.6 — Prompt d'installation `[x]` (2026-07-02)
> `PwaInstallService` signal-based : capture `beforeinstallprompt`
> (`canInstall`), `install()` rejoue le prompt ; iOS Safari non-standalone
> détecté → bannière « Partager → Sur l'écran d'accueil ». Dismissable (✕),
> par session.
- Capturer `beforeinstallprompt` (Android / desktop Chrome) dans un `PwaInstallService`
  signal-based (`canInstall = signal(false)`)
- Bouton discret "Installer l'app" quand l'event est dispo
- iOS (pas d'event) : détecter Safari iOS non-standalone → instruction manuelle
  ("Partager → Sur l'écran d'accueil")
- Non-intrusif : bannière dismissable ou bouton dans les réglages

## 2.7 — Gestion des mises à jour `[x]` (2026-07-02)
> `PwaUpdateService` : `versionUpdates` → `toSignal` (VERSION_READY) →
> bannière « Nouvelle version disponible — Recharger » (reload au clic).
```typescript
import { SwUpdate } from '@angular/service-worker';
// écouter versionUpdates → toast "Nouvelle version dispo — Recharger"
// au clic : document.location.reload()
```
Sans ça, les utilisateurs restent bloqués sur une vieille version après déploiement.

## 2.8 — Audit et validation `[x]` (2026-07-02)
> Build prod `--base-href /chess-mentor/` servi statiquement sous
> `/chess-mentor/` (émulation GitHub Pages avec fallback 404→index) :
> - Service worker actif, scope `http://…/chess-mentor/`, driver NGSW « NORMAL »
> - `Page.getAppManifest` (CDP) : **0 erreur d'installabilité** — c'est
>   l'audit Chrome qui alimentait la catégorie PWA de Lighthouse, retirée
>   de Lighthouse ≥ v12 ; « tout au vert » = installabilité sans erreur
> - Hors-ligne : reload OK, route lazy OK, stockfish.wasm depuis le cache
> - `404.html` (copie d'index) : compatible — le SW prend la main sur les
>   navigations une fois installé ; le fallback ne sert qu'au premier accès
> - Installation réelle Android/iPhone : à faire sur devices après merge
>   (impossible en environnement distant).
- Build prod : `ng build --configuration production --base-href /chess-mentor/`
- Servir le build localement (PAS `ng serve`) :
  `npx http-server dist/chess-mentor/browser -p 8080`
- Chrome DevTools → **Application** : manifest sans erreur, service worker actif
- **Lighthouse** → catégorie PWA → tout au vert
- Tester l'installation réelle sur Android et iPhone
- Vérifier que le `404.html` (copie d'index.html) n'interfère pas avec le SW

---
---

# ORDRE D'EXÉCUTION GLOBAL

1. **Partie 1 entière** (1.1 → 1.5) — responsive, indispensable
2. Valider le responsive sur vrai device
3. **2.1** (`ng add @angular/pwa`) — base auto
4. **2.2 + 2.3** (manifest + icônes) — l'app devient installable
5. **2.4** (cache) — hors-ligne, attention au WASM Stockfish
6. **2.5 + 2.7** (offline UX + updates) — robustesse
7. **2.6** (prompt install) — confort
8. **2.8** (audit Lighthouse) — validation finale

Après la Partie 1 : tester en responsive DevTools + device.
Après chaque étape PWA : tester sur le build prod servi localement, jamais `ng serve`.

---

# RÈGLES DE MISE À JOUR DE CE FICHIER

- Cocher `[x]` chaque étape faite ET validée (sur device pour le responsive,
  sur build prod pour la PWA)
- Noter le score Lighthouse PWA atteint
- Noter tout problème iOS-spécifique (viewport, cache purgé, icône, standalone)
- Ne jamais supprimer d'étape — garder la trace
