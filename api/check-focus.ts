import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const client = new Anthropic()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { imageBase64, eventName } = req.body
  if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' })

  const task = eventName ? `"${eventName}"` : 'their current task'
  const prompt = `Is this person focused on ${task}? Look at their face and body language. Are they looking at their screen and engaged, or are they looking away, on their phone, or clearly distracted? Reply with only a number from 0 to 1. 0 = focused on ${task}, 1 = clearly distracted.`

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
          text: prompt,
        },
      ],
    }],
  })

  const raw = (msg.content[0] as { text: string }).text.trim()
  const score = parseFloat(raw)
  res.json({ score: isNaN(score) ? 0 : score })
}
