import { encodeQr, qrToSvg } from './qr.utils';

const URL = 'https://lichess.org/abcd1234';

function grid(): boolean[][] {
  const m = encodeQr(URL);
  expect(m).not.toBeNull();
  return m!;
}

/** Vérifie un motif de repérage 7×7 (anneau plein / vide / centre plein). */
function isFinderAt(m: boolean[][], row: number, col: number): boolean {
  for (let dr = 0; dr < 7; dr++) {
    for (let dc = 0; dc < 7; dc++) {
      const d = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
      const expected = d !== 2; // sombre partout sauf l'anneau clair à distance 2
      if (m[row + dr][col + dc] !== expected) return false;
    }
  }
  return true;
}

describe('encodeQr', () => {
  it('produit une matrice carrée de taille valide (4·version+17)', () => {
    const m = grid();
    const size = m.length;
    expect(m.every((r) => r.length === size)).toBe(true);
    expect((size - 17) % 4).toBe(0);
    expect(size).toBeGreaterThanOrEqual(21);
    expect(size).toBeLessThanOrEqual(57); // versions 1→10
  });

  it('place les trois motifs de repérage aux coins', () => {
    const m = grid();
    const size = m.length;
    expect(isFinderAt(m, 0, 0)).toBe(true);
    expect(isFinderAt(m, 0, size - 7)).toBe(true);
    expect(isFinderAt(m, size - 7, 0)).toBe(true);
  });

  it('trace les motifs de synchronisation alternés', () => {
    const m = grid();
    const size = m.length;
    for (let i = 8; i < size - 8; i++) {
      expect(m[6][i]).toBe(i % 2 === 0);
      expect(m[i][6]).toBe(i % 2 === 0);
    }
  });

  it('pose le module sombre obligatoire en (size-8, 8)', () => {
    const m = grid();
    expect(m[m.length - 8][8]).toBe(true);
  });

  it('est déterministe', () => {
    expect(encodeQr(URL)).toEqual(encodeQr(URL));
  });

  it('renvoie null au-delà de la capacité (version 10, ECC M)', () => {
    expect(encodeQr('x'.repeat(400))).toBeNull();
  });

  it('encode l’information de format de façon valide (BCH, niveau M)', () => {
    const m = grid();
    const size = m.length;
    // Copie 1, dans l'ordre de placement : le module i porte le bit 14−i,
    // donc `readBits[i]` correspond au bit MSB→LSB de la chaîne standard.
    const readBits: boolean[] = [];
    for (let i = 0; i <= 5; i++) readBits.push(m[8][i]);
    readBits.push(m[8][7], m[8][8], m[7][8]);
    for (let i = 9; i < 15; i++) readBits.push(m[14 - i][8]);

    // readBits[0] = f14 (MSB) … readBits[14] = f0 (LSB).
    let value = 0;
    for (let i = 0; i < 15; i++) if (readBits[i]) value |= 1 << (14 - i);
    value ^= 0b101010000010010; // dé-masque le XOR de format

    // Le BCH(15,5) doit être exact : reste nul en divisant par 0x537.
    let rem = value;
    for (let i = 14; i >= 10; i--) if (rem & (1 << i)) rem ^= 0x537 << (i - 10);
    expect(rem).toBe(0);

    // Les 2 bits de haut niveau = niveau de correction M (0b00).
    expect((value >> 13) & 0b11).toBe(0b00);
  });
});

describe('qrToSvg', () => {
  it('rend un SVG carré avec zone silencieuse et des modules', () => {
    const m = grid();
    const svg = qrToSvg(m);
    const dim = m.length + 8; // marge de 4 de chaque côté
    expect(svg).toContain(`viewBox="0 0 ${dim} ${dim}"`);
    expect(svg).toContain('<rect');
    expect(svg).toContain('role="img"');
  });
});
