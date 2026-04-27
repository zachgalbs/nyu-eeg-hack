import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '../_lib/db'
import { parseCookie } from '../_lib/cookies'
import { encryptSecret } from '../_lib/crypto'
import {
  createSession,
  buildSessionCookie,
  SESSION_TTL_SECONDS,
} from '../_lib/session'

const CSRF_COOKIE = 'oauth_csrf'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state } = req.query
  if (!code) return res.status(400).json({ error: 'Missing code' })

  // CSRF check — the nonce in `state` must match the nonce in the
  // short-lived cookie set during /api/auth/login.
  const expectedCsrf = parseCookie(req, CSRF_COOKIE)
  let csrfFromState: string | null = null
  let inviteToken: string | null = null
  try {
    const decoded = JSON.parse(
      Buffer.from(state as string, 'base64url').toString('utf8'),
    ) as { csrf?: string; invite?: string | null }
    csrfFromState = decoded.csrf ?? null
    inviteToken = decoded.invite ?? null
  } catch {
    return res.status(400).json({ error: 'Malformed OAuth state' })
  }
  if (!expectedCsrf || !csrfFromState || expectedCsrf !== csrfFromState) {
    return res.status(400).json({ error: 'OAuth CSRF check failed' })
  }

  const base = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: code as string,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${base}/api/auth/callback`,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()
  if (!tokens.access_token) {
    return res.status(400).json({ error: 'Token exchange failed', detail: tokens })
  }

  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const user = await userRes.json()

  const accessExpiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000)

  // Encrypt the refresh token before persisting. A read-only DB compromise
  // no longer hands the attacker every user's calendar.
  const encryptedRefresh = tokens.refresh_token
    ? encryptSecret(tokens.refresh_token)
    : null

  await sql`
    INSERT INTO users (user_id, name, email, avatar_url, google_refresh_token, google_token_expires_at)
    VALUES (
      ${user.id},
      ${user.name},
      ${user.email},
      ${user.picture ?? null},
      ${encryptedRefresh},
      ${accessExpiresAt.toISOString()}
    )
    ON CONFLICT (user_id) DO UPDATE
      SET name = EXCLUDED.name,
          email = EXCLUDED.email,
          avatar_url = EXCLUDED.avatar_url,
          google_refresh_token = COALESCE(EXCLUDED.google_refresh_token, users.google_refresh_token),
          google_token_expires_at = EXCLUDED.google_token_expires_at
  `

  // Auto-accept friendship if signed in via an invite link.
  if (inviteToken) {
    await sql`
      UPDATE friendships
      SET status = 'accepted', invitee_id = ${user.id}, accepted_at = NOW()
      WHERE invite_token = ${inviteToken}
        AND status = 'pending'
        AND inviter_id != ${user.id}
    `
  }

  // Mint an opaque server-side session. The cookie holds only the random
  // session_id; user_id lives in auth_sessions. Editing the cookie just
  // invalidates the session — it does NOT let an attacker pose as anyone.
  const sessionId = await createSession(user.id, {
    userAgent: req.headers['user-agent'] ?? null,
    ip:
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket?.remoteAddress ??
      null,
  })

  res.setHeader('Set-Cookie', [
    buildSessionCookie(sessionId, SESSION_TTL_SECONDS),
    // user_name is JS-readable for the frontend's display logic. Secure +
    // SameSite=Lax. NOT HttpOnly because the client reads it. Non-sensitive.
    `user_name=${encodeURIComponent(user.name)}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; Secure; SameSite=Lax`,
    // Clear legacy cookies from older sessions.
    `user_id=; Path=/; Max-Age=0; SameSite=Lax`,
    `google_token=; Path=/; Max-Age=0; SameSite=Lax`,
    `${CSRF_COOKIE}=; Path=/api/auth; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
  ])

  res.redirect(inviteToken ? '/friends' : '/')
}
