import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const client = new Anthropic()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { imageBase64, eventName } = req.body
  if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' })

  const task = eventName ? `"${eventName}"` : 'their current task'
  const prompt = `Is this person focused on ${task}? Look at their face and body language. Are they looking at their screen and engaged, or are they looking away, on their phone, or clearly distracted? Reply with only a number from 0 to 1. 0 = focused on ${task}, 1 = clearly distracted.`

  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
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
    const match = raw.match(/(?:^|\D)([01](?:\.\d+)?)/)
    const parsed = match ? parseFloat(match[1]) : NaN
    const score = isNaN(parsed) ? 0 : Math.max(0, Math.min(1, parsed))
    const distracted = score > 0.5
    console.log('[check-focus]', JSON.stringify({
      eventName: eventName ?? null,
      imageBytes: imageBase64.length,
      rawClaude: raw,
      parsedScore: score,
      distracted,
    }))
    return res.json({ score, raw, distracted })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const name = err instanceof Error ? err.name : 'Error'
    console.error('[check-focus] error', name, message)
    return res.status(500).json({ error: 'Anthropic call failed', name, message })
  }
}
