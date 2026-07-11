import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Chess } from 'chess.js';

import { LichessAuthService } from '../../../../core/services/lichess-auth.service';
import { LichessBoardService } from '../../../../core/services/lichess-board.service';
import { NetworkService } from '../../../../core/services/network.service';
import { SoundService } from '../../../../core/services/sound.service';
import { StorageService } from '../../../../core/services/storage.service';
import { OnlineGameStore } from '../../../../core/store/online.store';
import { OnlineGameConfig } from '../../../../core/models/online.model';
import { SavedGame } from '../../../../core/models/saved-game.model';
import { InstructorMove } from '../../../../core/models/instructor.model';
import { Chessboard } from '../../../board/components/chessboard/chessboard';
import { CaptureBar } from '../../../instructor/components/capture-bar/capture-bar';
import { captureSummary } from '../../../instructor/utils/captures.utils';
import { formatMs, resultLabel } from '../../utils/online.utils';
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

  private seekCtrl: AbortController | null = null;
  private eventsCtrl: AbortController | null = null;
  private gameCtrl: AbortController | null = null;
  private openChallengeId: string | null = null;
  private savedGameId: string | null = null;
  private readonly clockInterval = setInterval(() => this.now.set(Date.now()), 200);

  constructor() {
    this.destroyRef.onDestroy(() => {
      clearInterval(this.clockInterval);
      // La partie continue côté Lichess ; on coupe seulement les flux locaux.
      this.abortAll();
    });
    void this.bootstrap();
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
    } catch {
      // init() gère déjà `ready` dans son finally ; ne jamais bloquer la page.
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

  private abortAll(): void {
    this.seekCtrl?.abort();
    this.eventsCtrl?.abort();
    this.gameCtrl?.abort();
    this.seekCtrl = this.eventsCtrl = this.gameCtrl = null;
  }

  // ─── Auth ───────────────────────────────────────────────────────────────
  protected login(): void {
    void this.auth.login();
  }

  protected logout(): void {
    this.abortAll();
    this.store.reset();
    void this.auth.logout();
  }

  // ─── Matchmaking ────────────────────────────────────────────────────────
  /** Écoute gameStart pour basculer sur la partie dès qu'elle existe. */
  private listenForGameStart(): void {
    this.eventsCtrl?.abort();
    this.eventsCtrl = new AbortController();
    void this.board
      .streamAccountEvents((event) => {
        if (event.type === 'gameStart') {
          this.seekCtrl?.abort();
          this.openChallengeId = null;
          this.savedGameId = null;
          this.store.enterGame(event.game.gameId, event.game.color);
          this.streamCurrentGame(event.game.gameId);
        }
      }, this.eventsCtrl.signal)
      .catch(() => {
        // Flux compte coupé : le flux de partie a sa propre reconnexion.
      });
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

  protected async seek(): Promise<void> {
    if (this.busy() || !this.isOnline()) return;
    this.busy.set(true);
    this.store.startSeeking();
    this.listenForGameStart();
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
      this.listenForGameStart();
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
      await this.board.challengeUser(name, this.config());
      this.store.startWaiting('');
      this.listenForGameStart();
    } catch {
      this.store.setError(`Défi impossible — « ${name} » existe-t-il sur Lichess ?`);
    } finally {
      this.busy.set(false);
    }
  }

  protected cancelSearch(): void {
    if (this.openChallengeId) {
      void this.board.cancelChallenge(this.openChallengeId).catch(() => undefined);
      this.openChallengeId = null;
    }
    this.abortAll();
    this.store.reset();
  }

  protected copyShareUrl(): void {
    const url = this.store.shareUrl();
    if (url) void navigator.clipboard?.writeText(url);
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

  protected newGame(): void {
    this.abortAll();
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
