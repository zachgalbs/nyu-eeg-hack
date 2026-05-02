import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './db';
import { parseCookie } from './cookies';

/**
 * Server-side session store. The client cookie holds an opaque random
 * session_id; user_id is looked up in `auth_sessions`. Editing the cookie
 * just invalidates the session — it does NOT let an attacker pose as a
 * different user (unlike the old "user_id=<google_id>" cookie pattern).
 */

const SESSION_COOKIE = 'session_id';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const SESSION_TTL_SECONDS = DEFAULT_TTL_SECONDS;

export async function createSession(
  userId: string,
  meta?: { userAgent?: string | null; ip?: string | null },
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<string> {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await sql`
    INSERT INTO auth_sessions (session_id, user_id, expires_at, user_agent, ip_addr)
    VALUES (
      ${sessionId},
      ${userId},
      ${expiresAt.toISOString()},
      ${meta?.userAgent ?? null},
      ${meta?.ip ?? null}
    )
  `;
  return sessionId;
}

export async function getUserIdFromRequest(req: VercelRequest): Promise<string | null> {
  const sessionId = parseCookie(req, SESSION_COOKIE);
  if (!sessionId) return null;
  // Defensive: reject anything that isn't 64 lowercase hex chars before
  // hitting the DB. Cuts noise from probing/garbage cookies.
  if (!/^[a-f0-9]{64}$/.test(sessionId)) return null;

  const { rows } = await sql`
    SELECT user_id, expires_at FROM auth_sessions
    WHERE session_id = ${sessionId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  if (new Date(rows[0].expires_at as string).getTime() < Date.now()) {
    // Best-effort cleanup; don't await failure
    sql`DELETE FROM auth_sessions WHERE session_id = ${sessionId}`.catch(() => {});
    return null;
  }
  return rows[0].user_id as string;
}

export async function destroySession(req: VercelRequest): Promise<void> {
  const sessionId = parseCookie(req, SESSION_COOKIE);
  if (!sessionId) return;
  await sql`DELETE FROM auth_sessions WHERE session_id = ${sessionId}`;
}

export function buildSessionCookie(sessionId: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  return [
    `${SESSION_COOKIE}=${sessionId}`,
    'Path=/',
    `Max-Age=${ttlSeconds}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');
}

export function buildClearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function buildClearedUserNameCookie(): string {
  return `user_name=; Path=/; Max-Age=0; Secure; SameSite=Lax`;
}

/**
 * Auth guard for API handlers. Returns the userId on success; on failure,
 * sends a 401 response AND clears the `session_id` and `user_name` cookies
 * so the client UI (which gates "Connect Google Calendar" on the presence
 * of `user_name`) re-renders correctly the next time the page loads.
 *
 * Usage:
 *   const userId = await requireUser(req, res);
 *   if (!userId) return;
 */
export async function requireUser(
  req: VercelRequest,
  res: VercelResponse,
  message: string = 'Not signed in',
): Promise<string | null> {
  const userId = await getUserIdFromRequest(req);
  if (userId) return userId;
  res.setHeader('Set-Cookie', [
    buildClearedSessionCookie(),
    buildClearedUserNameCookie(),
  ]);
  res.status(401).json({ error: message });
  return null;
}
