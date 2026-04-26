import { GoogleGenerativeAI } from '@google/generative-ai'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { imageBase64, eventName } = req.body
  if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' })

  const task = eventName ? `"${eventName}"` : 'their current task'
  const prompt = `Is this person focused on ${task}? Look at their face and body language. Are they looking at their screen and engaged, or are they looking away, on their phone, or clearly distracted? Reply with only a number from 0 to 1. 0 = focused on ${task}, 1 = clearly distracted.`

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' })

    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: 'image/jpeg',
        },
      },
      prompt,
    ])

    const raw = result.response.text().trim()
    const match = raw.match(/(?:^|\D)([01](?:\.\d+)?)/)
    const parsed = match ? parseFloat(match[1]) : NaN
    const score = isNaN(parsed) ? 0 : Math.max(0, Math.min(1, parsed))
    const distracted = score > 0.5
    console.log('[check-focus]', JSON.stringify({
      eventName: eventName ?? null,
      imageBytes: imageBase64.length,
      rawGemini: raw,
      parsedScore: score,
      distracted,
    }))
    return res.json({ score, raw, distracted })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const name = err instanceof Error ? err.name : 'Error'
    console.error('[check-focus] error', name, message)
    return res.status(500).json({ error: 'Gemini call failed', name, message })
  }
}
