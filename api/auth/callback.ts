import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '../lib/db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state } = req.query
  if (!code) return res.status(400).json({ error: 'Missing code' })

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

  // Upsert user into DB
  await sql`
    INSERT INTO users (user_id, name, email, avatar_url)
    VALUES (${user.id}, ${user.name}, ${user.email}, ${user.picture ?? null})
    ON CONFLICT (user_id) DO UPDATE
      SET name = EXCLUDED.name,
          email = EXCLUDED.email,
          avatar_url = EXCLUDED.avatar_url
  `

  // Accept pending friendship if coming from an invite link
  const inviteToken = typeof state === 'string' && state.startsWith('invite:')
    ? state.slice(7)
    : null

  if (inviteToken) {
    await sql`
      UPDATE friendships
      SET status = 'accepted', invitee_id = ${user.id}, accepted_at = NOW()
      WHERE invite_token = ${inviteToken}
        AND status = 'pending'
        AND inviter_id != ${user.id}
    `
  }

  const tokenMaxAge = 3600          // google_token expires with the OAuth token
  const sessionMaxAge = 60 * 60 * 24 * 30  // user_id/name persist for 30 days
  res.setHeader('Set-Cookie', [
    `google_token=${tokens.access_token}; Path=/; Max-Age=${tokenMaxAge}; SameSite=Lax`,
    `user_id=${user.id}; Path=/; Max-Age=${sessionMaxAge}; SameSite=Lax`,
    `user_name=${encodeURIComponent(user.name)}; Path=/; Max-Age=${sessionMaxAge}; SameSite=Lax`,
  ])

  // Redirect to friends page if coming from invite, otherwise home
  res.redirect(inviteToken ? '/friends' : '/')
}
