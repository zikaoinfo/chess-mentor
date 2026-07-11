import { challengeS256, randomVerifier } from './pkce.utils';

describe('PKCE utils (RFC 7636)', () => {
  it('génère un verifier dans le charset unreserved, à la bonne longueur', () => {
    const v = randomVerifier(64);
    expect(v).toHaveLength(64);
    expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
    // Deux tirages ne se ressemblent pas.
    expect(randomVerifier(64)).not.toBe(v);
  });

  it('respecte les bornes RFC (43–128) par défaut', () => {
    expect(randomVerifier().length).toBeGreaterThanOrEqual(43);
    expect(randomVerifier().length).toBeLessThanOrEqual(128);
  });

  it('calcule le challenge S256 du vecteur de test officiel', async () => {
    // RFC 7636, appendix B.
    const challenge = await challengeS256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});
