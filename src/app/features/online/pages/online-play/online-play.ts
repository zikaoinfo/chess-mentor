import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Chess } from 'chess.js';

import { LichessAuthService } from '../../../../core/services/lichess-auth.service';
import { LichessBoardService } from '../../../../core/services/lichess-board.service';
import { NetworkService } from '../../../../core/services/network.service';
import { SoundService } from '../../../../core/services/sound.service';
import { StorageService } from '../../../../core/services/storage.service';
import { OnlineGameStore } from '../../../../core/store/online.store';
import { LichessAccountEvent, OnlineGameConfig } from '../../../../core/models/online.model';
import { Friend } from '../../../../core/models/friend.model';
import { SavedGame } from '../../../../core/models/saved-game.model';
import { InstructorMove } from '../../../../core/models/instructor.model';
import { Chessboard } from '../../../board/components/chessboard/chessboard';
import { CaptureBar } from '../../../instructor/components/capture-bar/capture-bar';
import { captureSummary } from '../../../instructor/utils/captures.utils';
import { formatMs, resultLabel, shareInviteText, toIncomingChallenge } from '../../utils/online.utils';
import { encodeQr, qrToSvg } from '../../utils/qr.utils';
import { fenTurn, kingSquare } from '../../../board/utils/fen.utils';

interface CadencePreset {
  readonly label: string;
  readonly limitMinutes: number;
  readonly incrementSeconds: number;
}

/** L'API Board n'accepte que rapide et plus lent pour le temps réel. */
const CADENCES: readonly CadencePreset[] = [
  { label: 'Rapide 10+0', limitMinutes: 10, incrementSeconds: 0 },
  { label: 'Rapide 10+5', limitMinutes: 10, incrementSeconds: 5 },
  { label: 'Rapide 15+10', limitMinutes: 15, incrementSeconds: 10 },
  { label: 'Classique 30+0', limitMinutes: 30, incrementSeconds: 0 },
];

/** Page « Jouer en ligne » : OAuth Lichess, matchmaking, partie temps réel. */
@Component({
  selector: 'app-online-play',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Chessboard, CaptureBar],
  templateUrl: './online-play.html',
  styleUrl: './online-play.scss',
})
export class OnlinePlay {
  private readonly auth = inject(LichessAuthService);
  private readonly board = inject(LichessBoardService);
  private readonly network = inject(NetworkService);
  private readonly sound = inject(SoundService);
  private readonly storage = inject(StorageService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly store = inject(OnlineGameStore);

  protected readonly cadences = CADENCES;
  protected readonly cadence = signal<CadencePreset>(CADENCES[0]);
  protected readonly rated = signal(false);
  protected readonly color = signal<'white' | 'black' | 'random'>('random');
  protected readonly friendName = signal('');
  protected readonly busy = signal(false);
  /** Adversaires récents (persistés) pour les raccourcis « rejouer contre ». */
  protected readonly friends = signal<readonly Friend[]>([]);

  protected readonly authReady = this.auth.ready;
  protected readonly isLoggedIn = this.auth.isLoggedIn;
  protected readonly username = this.auth.username;
  protected readonly authError = this.auth.error;
  protected readonly isOnline = this.network.isOnline;

  /** Pendules affichées : décompte local depuis la dernière synchro stream. */
  private readonly now = signal(Date.now());
  protected readonly whiteClock = computed(() => formatMs(this.remainingMs('white')));
  protected readonly blackClock = computed(() => formatMs(this.remainingMs('black')));
  protected readonly lowWhite = computed(() => this.remainingMs('white') < 30_000);
  protected readonly lowBlack = computed(() => this.remainingMs('black') < 30_000);

  protected readonly myClock = computed(() =>
    this.store.myColor() === 'white' ? this.whiteClock() : this.blackClock(),
  );
  protected readonly oppClock = computed(() =>
    this.store.myColor() === 'white' ? this.blackClock() : this.whiteClock(),
  );
  protected readonly myLow = computed(() =>
    this.store.myColor() === 'white' ? this.lowWhite() : this.lowBlack(),
  );
  protected readonly oppLow = computed(() =>
    this.store.myColor() === 'white' ? this.lowBlack() : this.lowWhite(),
  );

  protected readonly checkSquare = computed(() => {
    if (!this.store.inCheck()) return null;
    const fen = this.store.fen();
    return kingSquare(fen, fenTurn(fen));
  });

  /** Barres de captures, comme contre le bot. */
  private readonly captures = computed(() => captureSummary(this.uciList()));
  protected readonly myCaptures = computed(() =>
    this.store.myColor() === 'white' ? this.captures().byWhite : this.captures().byBlack,
  );
  protected readonly oppCaptures = computed(() =>
    this.store.myColor() === 'white' ? this.captures().byBlack : this.captures().byWhite,
  );
  protected readonly myAdvantage = computed(() => {
    const diff = this.captures().diff;
    return this.store.myColor() === 'white' ? diff : -diff;
  });
  protected readonly oppPieceColor = computed<'w' | 'b'>(() =>
    this.store.myColor() === 'white' ? 'w' : 'b',
  );
  protected readonly myPieceColor = computed<'w' | 'b'>(() =>
    this.store.myColor() === 'white' ? 'b' : 'w',
  );

  protected readonly finishLabel = computed(() =>
    resultLabel({ status: this.store.status(), winner: this.store.winner() ?? undefined }, this.store.myColor()),
  );

  /** Nom de l'adversaire humain, s'il est re-défiable (revanche / mémorisation). */
  protected readonly rematchName = computed(() => {
    const opp = this.store.opponent();
    if (!opp || !opp.name || opp.name === '?' || opp.name.startsWith('Stockfish')) return null;
    return opp.name;
  });

  /** QR code du lien de défi ouvert (jeu en présentiel : on scanne au lieu de taper). */
  protected readonly qrSvg = computed<SafeHtml | null>(() => {
    const url = this.store.shareUrl();
    if (!url) return null;
    const modules = encodeQr(url);
    if (!modules) return null;
    return this.sanitizer.bypassSecurityTrustHtml(qrToSvg(modules));
  });

  protected readonly canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  private seekCtrl: AbortController | null = null;
  private accountCtrl: AbortController | null = null;
  private gameCtrl: AbortController | null = null;
  private accountRunning = false;
  private openChallengeId: string | null = null;
  private savedGameId: string | null = null;
  /** gameId déjà mémorisé comme adversaire récent (évite le double comptage). */
  private recordedGameId: string | null = null;
  private readonly clockInterval = setInterval(() => this.now.set(Date.now()), 200);

  constructor() {
    this.destroyRef.onDestroy(() => {
      clearInterval(this.clockInterval);
      // La partie continue côté Lichess ; on coupe seulement les flux locaux.
      this.abortMatchmaking();
      this.accountCtrl?.abort();
    });
    void this.bootstrap();
    void this.reloadFriends();
  }

  private async bootstrap(): Promise<void> {
    try {
      await this.auth.init();
      const params = this.route.snapshot.queryParamMap;
      const code = params.get('code');
      const state = params.get('state');
      if (code && state) {
        await this.auth.handleCallback(code, state);
        // Nettoie ?code=… de l'URL (et de l'historique).
        void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      }
      // Le stream de compte tourne en continu : il capte les défis entrants
      // ET le gameStart des parties (matchmaking ou défi accepté).
      if (this.auth.isLoggedIn()) this.startAccountStream();
    } catch {
      // init() gère déjà `ready` dans son finally ; ne jamais bloquer la page.
    }
  }

  private async reloadFriends(): Promise<void> {
    try {
      this.friends.set(await this.storage.allFriends());
    } catch {
      // Stockage indisponible : la liste reste simplement vide.
    }
  }

  private uciList(): readonly string[] {
    return this.store.moves().split(' ').filter((m) => m.length > 0);
  }

  private remainingMs(side: 'white' | 'black'): number {
    const base = side === 'white' ? this.store.wtime() : this.store.btime();
    if (this.store.phase() !== 'playing') return base;
    const turn = fenTurn(this.store.fen()) === 'w' ? 'white' : 'black';
    if (turn !== side) return base;
    return base - Math.max(0, this.now() - this.store.clockSyncAt());
  }

  private config(): OnlineGameConfig {
    return {
      limitMinutes: this.cadence().limitMinutes,
      incrementSeconds: this.cadence().incrementSeconds,
      rated: this.rated(),
      color: this.color(),
    };
  }

  private abortMatchmaking(): void {
    this.seekCtrl?.abort();
    this.gameCtrl?.abort();
    this.seekCtrl = this.gameCtrl = null;
  }

  // ─── Auth ───────────────────────────────────────────────────────────────
  protected login(): void {
    void this.auth.login();
  }

  protected logout(): void {
    this.abortMatchmaking();
    this.accountCtrl?.abort();
    this.accountRunning = false;
    this.store.reset();
    void this.auth.logout();
  }

  // ─── Stream de compte (continu) ──────────────────────────────────────────
  /** Démarre (une seule fois) l'écoute des événements de compte, avec reprise. */
  private startAccountStream(): void {
    if (this.accountRunning) return;
    this.accountRunning = true;
    this.accountCtrl = new AbortController();
    void this.accountLoop(this.accountCtrl.signal);
  }

  private async accountLoop(signal: AbortSignal): Promise<void> {
    let delayMs = 1000;
    while (!signal.aborted) {
      try {
        await this.board.streamAccountEvents((event) => {
          delayMs = 1000; // flux sain → reset du backoff
          this.onAccountEvent(event);
        }, signal);
      } catch {
        if (signal.aborted) return;
      }
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs = Math.min(delayMs * 2, 8000);
    }
  }

  private onAccountEvent(event: LichessAccountEvent): void {
    if (event.type === 'gameStart') {
      this.seekCtrl?.abort();
      this.openChallengeId = null;
      this.savedGameId = null;
      this.store.enterGame(event.game.gameId, event.game.color);
      this.streamCurrentGame(event.game.gameId);
    } else if (event.type === 'challenge') {
      const incoming = toIncomingChallenge(event.challenge, this.username() ?? '');
      // On ignore les défis que J'AI émis (échos) — seuls les reçus s'affichent.
      if (!incoming.mine) this.store.addChallenge(incoming);
    } else if (event.type === 'challengeCanceled' || event.type === 'challengeDeclined') {
      this.store.removeChallenge(event.challenge.id);
    }
  }

  private streamCurrentGame(gameId: string): void {
    this.gameCtrl?.abort();
    this.gameCtrl = new AbortController();
    void this.board.streamGame(
      gameId,
      {
        onEvent: (event) => {
          if (event.type === 'gameFull') {
            this.store.applyGameFull(event, this.username() ?? '');
            void this.recordOpponent(gameId);
          } else if (event.type === 'gameState') {
            const before = this.store.moves();
            this.store.applyGameState(event);
            if (event.moves !== before && event.moves.length > 0) this.sound.move();
            if (this.store.isOver()) {
              this.sound.gameOver();
              void this.persistFinishedGame();
            }
          }
        },
        onConnection: (connected) => this.store.setConnected(connected),
        isOver: () => this.store.isOver(),
      },
      this.gameCtrl.signal,
    );
  }

  /** Mémorise l'adversaire humain comme « récent » — une fois par partie. */
  private async recordOpponent(gameId: string): Promise<void> {
    if (this.recordedGameId === gameId) return;
    const name = this.rematchName();
    if (!name) return;
    this.recordedGameId = gameId;
    try {
      await this.storage.recordFriend(name);
      await this.reloadFriends();
    } catch {
      // Best effort : l'absence de mémorisation ne casse pas la partie.
    }
  }

  // ─── Matchmaking ────────────────────────────────────────────────────────
  protected async seek(): Promise<void> {
    if (this.busy() || !this.isOnline()) return;
    this.busy.set(true);
    this.store.startSeeking();
    this.seekCtrl = new AbortController();
    try {
      await this.board.seek(this.config(), this.seekCtrl.signal);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        this.store.setError('Recherche impossible (cadence trop rapide ou réseau).');
        this.store.reset();
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async createOpenChallenge(): Promise<void> {
    if (this.busy() || !this.isOnline()) return;
    this.busy.set(true);
    try {
      const res = await this.board.challengeOpen(this.config());
      this.openChallengeId = res.id;
      this.store.startWaiting(res.url);
    } catch {
      this.store.setError('Création du défi impossible.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async challengeFriend(): Promise<void> {
    const name = this.friendName().trim();
    if (!name || this.busy() || !this.isOnline()) return;
    this.busy.set(true);
    try {
      // Valide le pseudo d'abord : message clair si le compte n'existe pas.
      const resolved = await this.board.userExists(name);
      if (resolved === null) {
        this.store.setError(`« ${name} » n'existe pas sur Lichess — vérifie le pseudo.`);
        return;
      }
      await this.board.challengeUser(resolved, this.config());
      this.store.startWaiting('');
    } catch {
      this.store.setError(`Défi impossible — « ${name} » accepte-t-il les défis ?`);
    } finally {
      this.busy.set(false);
    }
  }

  /** Défie directement un adversaire récent (raccourci depuis une puce). */
  protected challengeFromChip(friend: Friend): void {
    this.friendName.set(friend.name);
    void this.challengeFriend();
  }

  protected cancelSearch(): void {
    if (this.openChallengeId) {
      void this.board.cancelChallenge(this.openChallengeId).catch(() => undefined);
      this.openChallengeId = null;
    }
    this.abortMatchmaking();
    this.store.reset();
  }

  // ─── Défis entrants ───────────────────────────────────────────────────────
  protected async acceptChallenge(id: string): Promise<void> {
    this.store.removeChallenge(id);
    try {
      // gameStart arrivera via le stream de compte → bascule sur la partie.
      await this.board.acceptChallenge(id);
    } catch {
      this.store.setError('Impossible d’accepter le défi (déjà expiré ?).');
    }
  }

  protected declineChallenge(id: string): void {
    this.store.removeChallenge(id);
    void this.board.declineChallenge(id).catch(() => undefined);
  }

  // ─── Partage du lien de défi ──────────────────────────────────────────────
  protected copyShareUrl(): void {
    const url = this.store.shareUrl();
    if (url) void navigator.clipboard?.writeText(url);
  }

  /** Partage natif (WhatsApp/SMS/…) si dispo, sinon repli sur la copie. */
  protected async shareInvite(): Promise<void> {
    const url = this.store.shareUrl();
    if (!url) return;
    if (this.canNativeShare) {
      try {
        await navigator.share({ title: 'Partie ChessMentor', text: shareInviteText(url), url });
        return;
      } catch {
        // Annulé par l'utilisateur ou indisponible : on retombe sur la copie.
      }
    }
    this.copyShareUrl();
  }

  // ─── En jeu ─────────────────────────────────────────────────────────────
  protected async onMove(uci: string): Promise<void> {
    const gameId = this.store.gameId();
    if (!gameId || !this.store.isMyTurn()) return;
    if (!this.store.applyLocalMove(uci)) return;
    this.sound.move();
    try {
      await this.board.makeMove(gameId, uci);
    } catch {
      // Coup refusé par le serveur : on revient à l'état confirmé.
      this.store.revertToServer();
      this.store.setError('Coup refusé par Lichess.');
    }
  }

  protected resign(): void {
    const gameId = this.store.gameId();
    if (!gameId || !globalThis.confirm('Abandonner la partie ?')) return;
    void this.board.resign(gameId).catch(() => this.store.setError('Abandon impossible.'));
  }

  protected offerDraw(): void {
    const gameId = this.store.gameId();
    if (!gameId) return;
    void this.board.respondDraw(gameId, true).catch(() => undefined);
  }

  protected respondDraw(accept: boolean): void {
    const gameId = this.store.gameId();
    if (!gameId) return;
    void this.board.respondDraw(gameId, accept).catch(() => undefined);
  }

  protected dismissError(): void {
    this.store.setError(null);
  }

  // ─── Après la partie ────────────────────────────────────────────────────
  /** Sauvegarde locale pour l'analyse Stockfish existante. */
  private async persistFinishedGame(): Promise<void> {
    if (this.savedGameId) return;
    const ucis = this.uciList();
    if (ucis.length === 0) return;
    const chess = new Chess();
    const myColorShort = this.store.myColor() === 'white' ? 'w' : 'b';
    const moves: InstructorMove[] = ucis.map((uci) => {
      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      });
      return { uci: move.lan, san: move.san, by: move.color === myColorShort ? 'player' : 'bot' };
    });
    const winner = this.store.winner();
    const game: SavedGame = {
      id: crypto.randomUUID(),
      playedAt: new Date(),
      playerColor: this.store.myColor(),
      difficulty: 'medium',
      result: winner ? (winner === 'white' ? 'white-wins' : 'black-wins') : this.store.status() === 'draw' || this.store.status() === 'stalemate' ? 'draw' : null,
      moves,
      botName: `${this.store.opponent()?.name ?? 'Adversaire'} (en ligne)`,
    };
    this.savedGameId = game.id;
    await this.storage.saveGame(game);
  }

  protected analyseGame(): void {
    if (this.savedGameId) {
      void this.router.navigate(['/review'], { queryParams: { game: this.savedGameId } });
    }
  }

  /** Revanche : re-défie le même adversaire, couleurs inversées. */
  protected rematch(): void {
    const name = this.rematchName();
    if (!name) return;
    // Inverse la couleur pour l'équité (on prend l'opposé de notre couleur).
    this.color.set(this.store.myColor() === 'white' ? 'black' : 'white');
    this.friendName.set(name);
    this.store.reset();
    void this.challengeFriend();
  }

  protected newGame(): void {
    this.abortMatchmaking();
    this.store.reset();
  }

  // ─── Config UI ──────────────────────────────────────────────────────────
  protected selectCadence(preset: CadencePreset): void {
    this.cadence.set(preset);
  }

  protected onFriendNameInput(event: Event): void {
    this.friendName.set((event.target as HTMLInputElement).value);
  }
}
