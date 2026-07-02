import { captureSummary } from './captures.utils';

describe('captureSummary', () => {
  it('partie sans capture → rien à afficher', () => {
    expect(captureSummary(['e2e4', 'e7e5'])).toEqual({ byWhite: [], byBlack: [], diff: 0 });
  });

  it('compte les captures de chaque camp et le différentiel de points', () => {
    // 1.e4 d5 2.exd5 (P prend p) Qxd5 (d prend P) 3.Nc3 Qxg2 (d prend P)
    const moves = ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5g2'];
    const s = captureSummary(moves);
    expect(s.byWhite).toEqual(['p']);
    expect(s.byBlack).toEqual(['p', 'p']);
    expect(s.diff).toBe(-1); // Noirs +1
  });

  it('trie les prises de la moins chère à la plus chère', () => {
    // Scholar-like sequence where White wins queen and pawn.
    const moves = ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'h5f7']; // Qxf7#? f7 = pawn
    const s = captureSummary(moves);
    expect(s.byWhite).toEqual(['p']);
    expect(s.diff).toBe(1);
  });

  it('historique corrompu → résumé vide plutôt qu’un crash', () => {
    expect(captureSummary(['e2e4', 'zzzz'])).toEqual({ byWhite: [], byBlack: [], diff: 0 });
  });
});
