import {
  challengeBody,
  formatMs,
  isFinished,
  movesToPosition,
  resultLabel,
  seekBody,
  shareInviteText,
  splitNdjson,
  toIncomingChallenge,
} from './online.utils';
import { RawChallenge } from '../../../core/models/online.model';

describe('toIncomingChallenge', () => {
  const raw: RawChallenge = {
    id: 'abc123',
    challenger: { id: 'rival', name: 'Rival', rating: 1350 },
    rated: false,
    speed: 'rapid',
    timeControl: { type: 'clock', limit: 600, increment: 0, show: '10+0' },
  };

  it('normalise un défi reçu (autre que moi)', () => {
    const c = toIncomingChallenge(raw, 'moi');
    expect(c).toEqual({
      id: 'abc123',
      fromName: 'Rival',
      fromRating: 1350,
      rated: false,
      speed: 'rapid',
      timeControl: '10+0',
      mine: false,
    });
  });

  it('repère un défi que J’AI émis (challenger == moi, casse ignorée)', () => {
    expect(toIncomingChallenge(raw, 'RIVAL').mine).toBe(true);
  });

  it('tolère un challenger absent', () => {
    const c = toIncomingChallenge({ id: 'x' }, 'moi');
    expect(c.fromName).toBe('?');
    expect(c.fromRating).toBeNull();
    expect(c.timeControl).toBeNull();
    expect(c.mine).toBe(false);
  });
});

describe('shareInviteText', () => {
  it('inclut l’URL dans un message d’invitation', () => {
    const url = 'https://lichess.org/abc';
    expect(shareInviteText(url)).toContain(url);
  });
});

describe('splitNdjson', () => {
  it('découpe les lignes complètes et garde le reste en tampon', () => {
    const r1 = splitNdjson('', '{"a":1}\n{"b":');
    expect(r1.lines).toEqual(['{"a":1}']);
    expect(r1.rest).toBe('{"b":');
    const r2 = splitNdjson(r1.rest, '2}\n');
    expect(r2.lines).toEqual(['{"b":2}']);
    expect(r2.rest).toBe('');
  });

  it('ignore les lignes vides de keep-alive', () => {
    expect(splitNdjson('', '\n\n{"x":1}\n\n').lines).toEqual(['{"x":1}']);
  });
});

describe('movesToPosition', () => {
  it('liste vide → position de départ, pas de dernier coup', () => {
    const p = movesToPosition('');
    expect(p.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(p.lastUci).toBeNull();
    expect(p.sanList).toEqual([]);
  });

  it('rejoue les coups UCI et rend SAN + échec (mat du berger)', () => {
    const p = movesToPosition('e2e4 e7e5 f1c4 b8c6 d1h5 g8f6 h5f7');
    expect(p.sanList).toEqual(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']);
    expect(p.lastUci).toBe('h5f7');
    expect(p.inCheck).toBe(true);
  });
});

describe('isFinished / resultLabel', () => {
  it('started ne termine pas ; mate/resign/draw terminent', () => {
    expect(isFinished('started')).toBe(false);
    expect(isFinished('mate')).toBe(true);
    expect(isFinished('resign')).toBe(true);
    expect(isFinished('draw')).toBe(true);
  });

  it('libellés côté joueur : victoire, défaite, nulle, annulée', () => {
    expect(resultLabel({ status: 'mate', winner: 'white' }, 'white')).toContain('Victoire');
    expect(resultLabel({ status: 'mate', winner: 'white' }, 'black')).toContain('Défaite');
    expect(resultLabel({ status: 'resign', winner: 'black' }, 'black')).toContain('abandon adverse');
    expect(resultLabel({ status: 'draw' }, 'white')).toBe('Partie nulle');
    expect(resultLabel({ status: 'aborted' }, 'white')).toBe('Partie annulée');
  });
});

describe('seekBody / challengeBody', () => {
  const config = { limitMinutes: 10, incrementSeconds: 5, rated: false, color: 'white' as const };

  it('seek : minutes + incrément + rated, couleur seulement en casual', () => {
    expect(seekBody(config)).toBe('time=10&increment=5&rated=false&color=white');
    expect(seekBody({ ...config, rated: true })).toBe('time=10&increment=5&rated=true');
    expect(seekBody({ ...config, color: 'random' })).not.toContain('color');
  });

  it('challenge : clock.limit en secondes', () => {
    const body = challengeBody(config);
    expect(body).toContain('clock.limit=600');
    expect(body).toContain('clock.increment=5');
    expect(body).toContain('color=white');
  });
});

describe('formatMs', () => {
  it('formate mm:ss, borne à zéro, passe en h:mm:ss au-delà d’une heure', () => {
    expect(formatMs(600_000)).toBe('10:00');
    expect(formatMs(59_500)).toBe('0:59');
    expect(formatMs(-100)).toBe('0:00');
    expect(formatMs(3_661_000)).toBe('1:01:01');
  });
});
