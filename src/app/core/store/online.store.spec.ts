import { TestBed } from '@angular/core/testing';
import { OnlineGameStore } from './online.store';
import { GameFullEvent, GameStateEvent } from '../models/online.model';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function gameState(over: Partial<GameStateEvent> = {}): GameStateEvent {
  return {
    type: 'gameState',
    moves: '',
    wtime: 600_000,
    btime: 600_000,
    status: 'started',
    ...over,
  };
}

const GAME_FULL: GameFullEvent = {
  type: 'gameFull',
  id: 'abc123',
  rated: false,
  clock: { initial: 600_000, increment: 5_000 },
  white: { name: 'Moi', rating: 1200 },
  black: { name: 'Rival', rating: 1350 },
  state: gameState({ moves: 'e2e4 e7e5' }),
};

describe('OnlineGameStore', () => {
  function setup() {
    TestBed.configureTestingModule({});
    return TestBed.inject(OnlineGameStore);
  }

  it('enterGame pose la partie et la couleur, phase playing', () => {
    const store = setup();
    store.enterGame('abc123', 'black');
    expect(store.phase()).toBe('playing');
    expect(store.gameId()).toBe('abc123');
    expect(store.myColor()).toBe('black');
  });

  it('applyGameFull détecte ma couleur par mon pseudo et remplit l’adversaire', () => {
    const store = setup();
    store.enterGame('abc123', 'white');
    store.applyGameFull(GAME_FULL, 'moi'); // insensible à la casse
    expect(store.myColor()).toBe('white');
    expect(store.opponent()?.name).toBe('Rival');
    expect(store.opponent()?.rating).toBe(1350);
    expect(store.clockInitial()).toBe(600);
    // L'état embarqué a été appliqué : 2 coups rejoués.
    expect(store.sanList()).toEqual(['e4', 'e5']);
    expect(store.lastMove()).toBe('e7e5');
  });

  it('applyGameState reconstruit la position et détecte la fin', () => {
    const store = setup();
    store.enterGame('abc123', 'white');
    store.applyGameState(gameState({ moves: 'e2e4', wtime: 55_000 }));
    expect(store.fen()).toContain(' b '); // aux Noirs de jouer
    expect(store.wtime()).toBe(55_000);
    expect(store.phase()).toBe('playing');

    store.applyGameState(gameState({ moves: 'e2e4 e7e5', status: 'resign', winner: 'white' }));
    expect(store.phase()).toBe('finished');
    expect(store.isOver()).toBe(true);
    expect(store.winner()).toBe('white');
  });

  it('isMyTurn suit le trait de la FEN et ma couleur', () => {
    const store = setup();
    store.enterGame('abc123', 'white');
    store.applyGameState(gameState({ moves: '' }));
    expect(store.isMyTurn()).toBe(true); // Blancs au trait
    store.applyGameState(gameState({ moves: 'e2e4' }));
    expect(store.isMyTurn()).toBe(false);
  });

  it('applyLocalMove joue en optimiste ; revertToServer restaure le serveur', () => {
    const store = setup();
    store.enterGame('abc123', 'white');
    store.applyGameState(gameState({ moves: '' }));
    expect(store.applyLocalMove('e2e4')).toBe(true);
    expect(store.fen()).not.toBe(START_FEN);
    // Le serveur refuse : retour à l'état confirmé (aucun coup).
    store.revertToServer();
    expect(store.fen()).toBe(START_FEN);
    expect(store.applyLocalMove('e2e5')).toBe(false); // coup illégal
  });

  it('signale l’offre de nulle adverse selon ma couleur', () => {
    const store = setup();
    store.enterGame('abc123', 'white');
    store.applyGameState(gameState({ bdraw: true }));
    expect(store.opponentDrawOffer()).toBe(true);
    store.enterGame('abc123', 'black');
    store.applyGameState(gameState({ bdraw: true }));
    expect(store.opponentDrawOffer()).toBe(false); // c'est ma propre offre
  });

  it('gère les défis entrants : ajout, remplacement par id, retrait', () => {
    const store = setup();
    const base = { fromName: 'Rival', fromRating: 1350, rated: false, speed: 'rapid', timeControl: '10+0', mine: false };
    store.addChallenge({ id: 'c1', ...base });
    store.addChallenge({ id: 'c2', ...base, fromName: 'Autre' });
    expect(store.incomingChallenges().map((c) => c.id)).toEqual(['c1', 'c2']);

    // Même id → remplace (pas de doublon), en conservant l'ordre en fin.
    store.addChallenge({ id: 'c1', ...base, fromRating: 1400 });
    expect(store.incomingChallenges()).toHaveLength(2);
    expect(store.incomingChallenges().find((c) => c.id === 'c1')?.fromRating).toBe(1400);

    store.removeChallenge('c1');
    expect(store.incomingChallenges().map((c) => c.id)).toEqual(['c2']);
  });

  it('enterGame purge les défis entrants (on quitte l’écran d’accueil)', () => {
    const store = setup();
    store.addChallenge({ id: 'c1', fromName: 'X', fromRating: null, rated: false, speed: 'rapid', timeControl: null, mine: false });
    store.enterGame('g1', 'white');
    expect(store.incomingChallenges()).toEqual([]);
  });
});
