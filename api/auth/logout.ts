import type { VercelRequest, VercelResponse } from '@vercel/node'
import { destroySession, buildClearedSessionCookie } from '../_lib/session'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
