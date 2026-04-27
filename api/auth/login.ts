import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

const CSRF_COOKIE = 'oauth_csrf'
const CSRF_TTL_SECONDS = 600 // 10 min — plenty for a normal sign-in round-trip

export default function handler(req: VercelRequest, res: VercelResponse) {
  const base = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  // Random nonce stored in a short-lived HttpOnly cookie. The same value is
  // also encoded into OAuth state. The callback compares the two — if they
  // don't match, abort. This is the standard OAuth CSRF defense.
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
