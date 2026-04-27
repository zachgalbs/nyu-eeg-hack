import { GoogleGenerativeAI } from '@google/generative-ai'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { imageBase64, imageBase64b, eventName } = req.body
  if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' })

  const task = eventName ? `"${eventName}"` : 'their current task'
  const photoCount = imageBase64b ? 'two photos taken one second apart' : 'one photo'
  const prompt = `You are a focus detector for a webcam-based study app. The camera faces the person — their screen is not visible because it is directly below the camera. You are given ${photoCount}.

Score 0 (focused): in AT LEAST ONE photo, eyes look straight at the camera (screen is just below it), OR eyes look downward toward a notebook, book, or desk. A closed eye in one photo is likely a blink — do not penalize it if the other photo shows focus.
Score 1 (distracted): in ALL photos, eyes are clearly looking to the side, person is on their phone, person has left the frame, or eyes are closed with no sign of reading.

Task context: the person is supposed to be working on ${task}.

Reply with a single number between 0 and 1. Do not explain. Examples: 0, 0.2, 0.8, 1`

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const imageParts: object[] = [
      { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
    ]
    if (imageBase64b) {
      imageParts.push({ inlineData: { data: imageBase64b, mimeType: 'image/jpeg' } })
    }

    const result = await model.generateContent([...imageParts, prompt])

    const raw = result.response.text().trim()
    const match = raw.match(/(?:^|\D)([01](?:\.\d+)?)/)
    const parsed = match ? parseFloat(match[1]) : NaN
    const score = isNaN(parsed) ? 0 : Math.max(0, Math.min(1, parsed))
    const distracted = score > 0.5

    const usage = result.response.usageMetadata
    const candidates = result.response.candidates ?? []
    const finishReason = candidates[0]?.finishReason ?? null
    const safetyRatings = candidates[0]?.safetyRatings ?? []

    console.log('[check-focus]', JSON.stringify({
      eventName: eventName ?? null,
      imageBytes: imageBase64.length,
      imageBytes2: imageBase64b ? imageBase64b.length : null,
      rawGemini: raw,
      parsedScore: score,
      distracted,
      promptTokens: usage?.promptTokenCount,
      outputTokens: usage?.candidatesTokenCount,
      finishReason,
    }))

    const verbose = req.query.verbose === '1'
    return res.json({
      score,
      raw,
      distracted,
      ...(verbose && {
        _geminiMeta: {
          model: 'gemini-2.5-flash',
          promptTokenCount: usage?.promptTokenCount,
          candidatesTokenCount: usage?.candidatesTokenCount,
          totalTokenCount: usage?.totalTokenCount,
          finishReason,
          safetyRatings: safetyRatings.map((r: { category: string; probability: string }) => ({
            category: r.category,
            probability: r.probability,
          })),
        },
      }),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const name = err instanceof Error ? err.name : 'Error'
    console.error('[check-focus] error', name, message)
    return res.status(500).json({ error: 'Gemini call failed', name, message })
  }
}
