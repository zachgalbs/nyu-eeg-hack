import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code } = req.query
  if (!code) return res.status(400).json({ error: 'Missing code' })

  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  // Exchange auth code for tokens
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

  // Fetch user profile
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const user = await userRes.json()

  // Store in cookies — readable by JS so frontend can use access_token for Calendar API
  const maxAge = 3600
  res.setHeader('Set-Cookie', [
    `google_token=${tokens.access_token}; Path=/; Max-Age=${maxAge}; SameSite=Lax`,
    `user_id=${user.id}; Path=/; Max-Age=${maxAge}; SameSite=Lax`,
    `user_name=${encodeURIComponent(user.name)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`,
  ])

  res.redirect('/')
}
