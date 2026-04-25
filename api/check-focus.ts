import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const client = new Anthropic()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { imageBase64 } = req.body
  if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' })

  const msg = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 10,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
        },
        {
          type: 'text',
          text: 'Is this person looking away from their screen or clearly distracted? Reply with only a number from 0 to 1. 1 = clearly distracted, 0 = focused.',
        },
      ],
    }],
  })

  const raw = (msg.content[0] as { text: string }).text.trim()
  const score = parseFloat(raw)
  res.json({ score: isNaN(score) ? 0 : score })
}
