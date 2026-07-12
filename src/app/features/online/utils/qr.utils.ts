/**
 * Générateur de QR code autonome (aucune dépendance externe, conforme à
 * l'esprit « pas de lib tierce » du CLAUDE.md). Mode octet, niveau de
 * correction M, versions 1→10 (largement assez pour une URL de défi).
 *
 * Algorithme standard ISO/IEC 18004 : motifs de repérage / synchro /
 * alignement, correction Reed-Solomon sur GF(256), puis choix du masque
 * par score de pénalité. Sortie : matrice booléenne + helper SVG.
 *
 * Portage compact de l'implémentation de référence de Project Nayuki
 * (QR Code generator, licence MIT).
 */

// Nombre de codewords de données par version, pour le niveau ECC M.
const DATA_CODEWORDS_M = [
  16, 28, 44, 64, 86, 108, 124, 154, 182, 216,
];
// Nombre de codewords de correction par bloc, niveau M.
const ECC_PER_BLOCK_M = [
  10, 16, 26, 18, 24, 16, 18, 22, 22, 26,
];
// Nombre de blocs de correction, niveau M.
const NUM_BLOCKS_M = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

/** Positions des centres des motifs d'alignement, par version (1→10). */
const ALIGN_POSITIONS: readonly (readonly number[])[] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

/** Le module (i,j) et sa valeur, plus un drapeau « réservé » (non masquable). */
interface Grid {
  readonly size: number;
  readonly modules: boolean[][];
  readonly reserved: boolean[][];
}

/** Encode `text` (UTF-8) en matrice booléenne QR, ou `null` si trop long. */
export function encodeQr(text: string): boolean[][] | null {
  const data = new TextEncoder().encode(text);
  const version = pickVersion(data.length);
  if (version === null) return null;

  const codewords = buildCodewords(data, version);
  const grid = buildGrid(version);
  drawFunctionPatterns(grid, version);
  placeData(grid, codewords);
  const mask = chooseMask(grid);
  applyMask(grid, mask);
  drawFormatBits(grid, mask);
  return grid.modules;
}

/** Plus petite version (1→10) dont la capacité octet couvre `byteLen`. */
function pickVersion(byteLen: number): number | null {
  for (let v = 1; v <= 10; v++) {
    // 4 bits mode + compteur de longueur (8 bits v1-9, 16 bits v10) + data.
    const lenBits = v < 10 ? 8 : 16;
    const capacityBits = DATA_CODEWORDS_M[v - 1] * 8;
    if (4 + lenBits + byteLen * 8 <= capacityBits) return v;
  }
  return null;
}

/** Data + en-tête + padding → codewords avec ECC entrelacé. */
function buildCodewords(data: Uint8Array, version: number): number[] {
  const bits: number[] = [];
  const push = (value: number, len: number): void => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(0b0100, 4); // mode octet
  push(data.length, version < 10 ? 8 : 16);
  for (const byte of data) push(byte, 8);

  const totalData = DATA_CODEWORDS_M[version - 1];
  const capacityBits = totalData * 8;
  // Terminateur (jusqu'à 4 bits) puis alignement octet.
  push(0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    dataBytes.push(b);
  }
  // Octets de remplissage alternés 0xEC / 0x11.
  for (let pad = 0xec; dataBytes.length < totalData; pad ^= 0xec ^ 0x11) {
    dataBytes.push(pad);
  }

  return interleaveWithEcc(dataBytes, version);
}

/** Répartit en blocs, calcule l'ECC Reed-Solomon, puis entrelace. */
function interleaveWithEcc(dataBytes: number[], version: number): number[] {
  const numBlocks = NUM_BLOCKS_M[version - 1];
  const eccLen = ECC_PER_BLOCK_M[version - 1];
  const totalData = DATA_CODEWORDS_M[version - 1];

  const shortBlockLen = Math.floor(totalData / numBlocks);
  const numLongBlocks = totalData % numBlocks; // blocs avec 1 codeword de plus
  const dataBlocks: number[][] = [];
  const eccBlocks: number[][] = [];

  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const len = shortBlockLen + (b >= numBlocks - numLongBlocks ? 1 : 0);
    const block = dataBytes.slice(offset, offset + len);
    offset += len;
    dataBlocks.push(block);
    eccBlocks.push(reedSolomon(block, eccLen));
  }

  const result: number[] = [];
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) {
    for (const block of dataBlocks) if (i < block.length) result.push(block[i]);
  }
  for (let i = 0; i < eccLen; i++) {
    for (const block of eccBlocks) result.push(block[i]);
  }
  return result;
}

// ─── Reed-Solomon sur GF(256), polynôme 0x11D ───────────────────────────
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/** Codewords de correction pour un bloc de données. */
function reedSolomon(data: number[], eccLen: number): number[] {
  // Polynôme générateur.
  const gen = new Array<number>(eccLen + 1).fill(0);
  gen[0] = 1;
  for (let i = 0; i < eccLen; i++) {
    for (let j = i; j >= 0; j--) {
      gen[j + 1] ^= gfMul(gen[j], GF_EXP[i]);
    }
  }
  const remainder = new Array<number>(eccLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder.shift()!;
    remainder.push(0);
    for (let j = 0; j < eccLen; j++) remainder[j] ^= gfMul(gen[j + 1], factor);
  }
  return remainder;
}

// ─── Construction de la matrice ─────────────────────────────────────────
function buildGrid(version: number): Grid {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const reserved = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  return { size, modules, reserved };
}

function setModule(grid: Grid, r: number, c: number, dark: boolean): void {
  grid.modules[r][c] = dark;
  grid.reserved[r][c] = true;
}

function drawFinder(grid: Grid, row: number, col: number): void {
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= grid.size || c < 0 || c >= grid.size) continue;
      const inner = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
      // Anneau : sombre à distance 2 ou 0-1 (centre 3×3), clair à distance 3.
      setModule(grid, r, c, inner !== 2 && inner <= 3);
    }
  }
}

function drawFunctionPatterns(grid: Grid, version: number): void {
  const size = grid.size;
  // Motifs de repérage aux 3 coins.
  drawFinder(grid, 0, 0);
  drawFinder(grid, 0, size - 7);
  drawFinder(grid, size - 7, 0);

  // Motifs de synchronisation.
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    setModule(grid, 6, i, dark);
    setModule(grid, i, 6, dark);
  }

  // Motifs d'alignement (sauf recouvrement avec les repères).
  const positions = ALIGN_POSITIONS[version - 1];
  for (const r of positions) {
    for (const c of positions) {
      if (grid.reserved[r][c]) continue; // coin déjà occupé par un repère
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const inner = Math.max(Math.abs(dr), Math.abs(dc));
          setModule(grid, r + dr, c + dc, inner !== 1);
        }
      }
    }
  }

  // Module sombre obligatoire.
  setModule(grid, size - 8, 8, true);

  // Réserve les zones de format (remplies plus tard).
  reserveFormatAreas(grid);
}

function reserveFormatAreas(grid: Grid): void {
  const size = grid.size;
  for (let i = 0; i < 9; i++) {
    if (!grid.reserved[8][i]) grid.reserved[8][i] = true;
    if (!grid.reserved[i][8]) grid.reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    grid.reserved[8][size - 1 - i] = true;
    grid.reserved[size - 1 - i][8] = true;
  }
}

/**
 * Place les bits de données en zigzag depuis le coin bas-droit : colonnes par
 * paires (droite puis gauche), direction alternée haut/bas à chaque paire, en
 * sautant la colonne de synchronisation (6).
 */
function placeData(grid: Grid, codewords: number[]): void {
  const size = grid.size;
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // saute la colonne de synchro verticale
    for (let vert = 0; vert < size; vert++) {
      const row = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        if (grid.reserved[row][col]) continue;
        let dark = false;
        if (bitIndex < totalBits) {
          const byte = codewords[bitIndex >> 3];
          dark = ((byte >> (7 - (bitIndex & 7))) & 1) === 1;
          bitIndex++;
        }
        grid.modules[row][col] = dark;
      }
    }
    upward = !upward;
  }
}

// ─── Masquage ────────────────────────────────────────────────────────────
function maskCondition(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function applyMask(grid: Grid, mask: number): void {
  for (let r = 0; r < grid.size; r++) {
    for (let c = 0; c < grid.size; c++) {
      if (!grid.reserved[r][c] && maskCondition(mask, r, c)) {
        grid.modules[r][c] = !grid.modules[r][c];
      }
    }
  }
}

/** Applique chaque masque, garde celui de plus faible pénalité. */
function chooseMask(grid: Grid): number {
  let best = 0;
  let bestPenalty = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(grid, m);
    drawFormatBits(grid, m);
    const penalty = computePenalty(grid);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      best = m;
    }
    applyMask(grid, m); // annule (le masque est son propre inverse)
  }
  return best;
}

function computePenalty(grid: Grid): number {
  const size = grid.size;
  const m = grid.modules;
  let penalty = 0;

  // Règle 1 : séries de 5+ modules identiques (lignes et colonnes).
  for (let r = 0; r < size; r++) {
    let runColor = m[r][0];
    let run = 1;
    for (let c = 1; c < size; c++) {
      if (m[r][c] === runColor) {
        run++;
      } else {
        if (run >= 5) penalty += 3 + (run - 5);
        runColor = m[r][c];
        run = 1;
      }
    }
    if (run >= 5) penalty += 3 + (run - 5);
  }
  for (let c = 0; c < size; c++) {
    let runColor = m[0][c];
    let run = 1;
    for (let r = 1; r < size; r++) {
      if (m[r][c] === runColor) {
        run++;
      } else {
        if (run >= 5) penalty += 3 + (run - 5);
        runColor = m[r][c];
        run = 1;
      }
    }
    if (run >= 5) penalty += 3 + (run - 5);
  }

  // Règle 2 : blocs 2×2 de même couleur.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) penalty += 3;
    }
  }

  // Règle 3 : motif 1:1:3:1:1 (comme un repère) dans une ligne/colonne.
  const pattern = [true, false, true, true, true, false, true];
  const hasPattern = (get: (i: number) => boolean, i: number): boolean => {
    for (let k = 0; k < 7; k++) if (get(i + k) !== pattern[k]) return false;
    return true;
  };
  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - 7; c++) {
      if (hasPattern((i) => m[r][i], c)) penalty += 40;
    }
  }
  for (let c = 0; c < size; c++) {
    for (let r = 0; r <= size - 7; r++) {
      if (hasPattern((i) => m[i][c], r)) penalty += 40;
    }
  }

  // Règle 4 : déséquilibre sombre/clair.
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m[r][c]) dark++;
  const ratio = (dark * 100) / (size * size);
  penalty += Math.floor(Math.abs(ratio - 50) / 5) * 10;

  return penalty;
}

// ─── Informations de format (niveau M + masque) ─────────────────────────
function drawFormatBits(grid: Grid, mask: number): void {
  // 2 bits ECC (M = 0b00) + 3 bits masque, protégés par BCH(15,5) et XOR.
  const data = (0b00 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0b101010000010010;

  const size = grid.size;
  // Les positions ci-dessous sont ordonnées du MSB (f14) vers le LSB (f0) :
  // le module i porte donc le bit 14−i de la chaîne de format standard.
  const bit = (i: number): boolean => ((bits >> (14 - i)) & 1) === 1;

  // Copie 1 : autour du repère haut-gauche.
  for (let i = 0; i <= 5; i++) grid.modules[8][i] = bit(i);
  grid.modules[8][7] = bit(6);
  grid.modules[8][8] = bit(7);
  grid.modules[7][8] = bit(8);
  for (let i = 9; i < 15; i++) grid.modules[14 - i][8] = bit(i);

  // Copie 2 : 7 bits verticaux (bas-gauche) + 8 bits horizontaux (haut-droit).
  // La verticale s'arrête à size-7 : le module sombre en (size-8,8) est préservé.
  for (let i = 0; i < 7; i++) grid.modules[size - 1 - i][8] = bit(i);
  for (let i = 7; i < 15; i++) grid.modules[8][size - 15 + i] = bit(i);
}

/**
 * Rend une matrice QR en chaîne SVG carrée (viewBox = nb de modules + marge
 * silencieuse de 4). Couleurs passées par l'appelant pour coller au thème.
 */
export function qrToSvg(
  modules: boolean[][],
  opts: { readonly dark: string; readonly light: string } = { dark: '#0f172a', light: '#ffffff' },
): string {
  const n = modules.length;
  const quiet = 4;
  const dim = n + quiet * 2;
  let rects = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (modules[r][c]) {
        rects += `<rect x="${c + quiet}" y="${r + quiet}" width="1.02" height="1.02"/>`;
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" ` +
    `style="display:block;width:100%;height:100%" shape-rendering="crispEdges" ` +
    `role="img" aria-label="QR code du lien de défi">` +
    `<rect width="${dim}" height="${dim}" fill="${opts.light}"/>` +
    `<g fill="${opts.dark}">${rects}</g>` +
    `</svg>`
  );
}
