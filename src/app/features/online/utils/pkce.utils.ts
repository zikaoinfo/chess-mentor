/**
 * OAuth2 PKCE helpers (RFC 7636). Lichess accepte les clients publics sans
 * enregistrement : pas de client secret, le code_verifier fait la preuve.
 */

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/** Random `code_verifier` in the RFC 7636 unreserved charset (43–128 chars). */
export function randomVerifier(length = 64): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => CHARSET[b % CHARSET.length]).join('');
}

/** Base64url without padding, per RFC 7636 appendix A. */
function base64Url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** S256 `code_challenge` for a verifier. */
export async function challengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(digest);
}
