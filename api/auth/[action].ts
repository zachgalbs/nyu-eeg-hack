import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import { sql } from '../_lib/db'
import { parseCookie } from '../_lib/cookies'
import { encryptSecret } from '../_lib/crypto'
import {
  createSession,
  destroySession,
  buildSessionCookie,
  buildClearedSessionCookie,
  SESSION_TTL_SECONDS,
} from '../_lib/session'

const CSRF_COOKIE = 'oauth_csrf'
const CSRF_TTL_SECONDS = 600

function getBase() {
  return process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? '')
  switch (action) {
    case 'login': return handleLogin(req, res)
    case 'callback': return handleCallback(req, res)
    case 'logout': return handleLogout(req, res)
    default: return res.status(404).json({ error: 'Unknown action' })
  }
}

function handleLogin(req: VercelRequest, res: VercelResponse) {
  const base = getBase()

  const csrfNonce = crypto.randomBytes(16).toString('hex')
  const inviteToken = req.query.invite_token as string | undefined

  const stateData = JSON.stringify({ csrf: csrfNonce, invite: inviteToken ?? null })
  const state = Buffer.from(stateData, 'utf8').toString('base64url')

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${base}/api/auth/callback`,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'openid',
      'email',
      'profile',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  res.setHeader('Set-Cookie', [
    `${CSRF_COOKIE}=${csrfNonce}; Path=/api/auth; Max-Age=${CSRF_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
  ])
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}

async function handleCallback(req: VercelRequest, res: VercelResponse) {
  const { code, state } = req.query
  if (!code) return res.status(400).json({ error: 'Missing code' })

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

  const base = getBase()

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

  if (inviteToken) {
    await sql`
      UPDATE friendships
      SET status = 'claimed', invitee_id = ${user.id}, claimed_at = NOW()
      WHERE invite_token = ${inviteToken}
        AND status = 'pending'
        AND inviter_id != ${user.id}
        AND (invite_expires_at IS NULL OR invite_expires_at > NOW())
    `
  }

  const sessionId = await createSession(user.id, {
    userAgent: req.headers['user-agent'] ?? null,
    ip:
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket?.remoteAddress ??
      null,
  })

  res.setHeader('Set-Cookie', [
    buildSessionCookie(sessionId, SESSION_TTL_SECONDS),
    `user_name=${encodeURIComponent(user.name)}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; Secure; SameSite=Lax`,
    `user_id=; Path=/; Max-Age=0; SameSite=Lax`,
    `google_token=; Path=/; Max-Age=0; SameSite=Lax`,
    `${CSRF_COOKIE}=; Path=/api/auth; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
  ])

  res.redirect(inviteToken ? '/friends' : '/')
}

async function handleLogout(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end()

  await destroySession(req)

  res.setHeader('Set-Cookie', [
    buildClearedSessionCookie(),
    `user_name=; Path=/; Max-Age=0; Secure; SameSite=Lax`,
  ])

  if (req.method === 'GET') {
    return res.redirect('/')
  }
  res.json({ ok: true })
}
