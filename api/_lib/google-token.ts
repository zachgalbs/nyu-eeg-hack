import { sql } from './db';
import { decryptSecret } from './crypto';

/**
 * Returns a valid Google access token for the user, refreshing it via the
 * stored refresh token if the cached one has expired or is missing.
 *
 * Throws if the user has no stored refresh token (must re-OAuth) or if the
 * refresh exchange fails (token revoked).
 */
export class TokenRefreshError extends Error {}

type CachedToken = {
  accessToken: string;
  expiresAt: Date;
};

// In-memory cache so we don't hit Google on every API request within the
// same warm function instance.
const memCache = new Map<string, CachedToken>();
const SKEW_MS = 60_000; // refresh 1 min early to avoid edge-of-expiry 401s

export async function getValidAccessToken(userId: string): Promise<string> {
  const cached = memCache.get(userId);
  if (cached && cached.expiresAt.getTime() - SKEW_MS > Date.now()) {
    return cached.accessToken;
  }

  const { rows } = await sql`
    SELECT google_refresh_token, google_token_expires_at
    FROM users
    WHERE user_id = ${userId}
  `;
  if (rows.length === 0 || !rows[0].google_refresh_token) {
    throw new TokenRefreshError('No refresh token on file — user must reconnect');
  }
  let refreshToken: string;
  try {
    refreshToken = decryptSecret(rows[0].google_refresh_token as string);
  } catch (err) {
    // Bad ciphertext or wrong key — treat as if there's no refresh token.
    console.error('refresh token decrypt failed', err);
    throw new TokenRefreshError('Refresh token unreadable — user must reconnect');
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    // Refresh token is dead (revoked, expired, scope changed). Clear it so
    // the user is forced to re-OAuth instead of looping on a bad token.
    await sql`
      UPDATE users
      SET google_refresh_token = NULL, google_token_expires_at = NULL
      WHERE user_id = ${userId}
    `;
    memCache.delete(userId);
    throw new TokenRefreshError('Refresh failed — user must reconnect');
  }

  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);
  memCache.set(userId, { accessToken: tokens.access_token, expiresAt });

  await sql`
    UPDATE users
    SET google_token_expires_at = ${expiresAt.toISOString()}
    WHERE user_id = ${userId}
  `;

  return tokens.access_token;
}
