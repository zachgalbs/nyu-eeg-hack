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

Reply with exactly this format: SCORE | REASON
- SCORE: a number 0–1
- REASON: ≤8 words describing exactly what you see

Examples:
0 | eyes on camera, looks focused
0 | reading downward, likely notebook
0.7 | eyes drifting right, possible distraction
1 | looking at phone in hand
1 | no person in frame`

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
    const pipeIdx = raw.indexOf('|')
    const scorePart = pipeIdx >= 0 ? raw.slice(0, pipeIdx) : raw
    const reason = pipeIdx >= 0 ? raw.slice(pipeIdx + 1).trim() : ''
    const match = scorePart.match(/([01](?:\.\d+)?)/)
    const parsed = match ? parseFloat(match[1]) : NaN
    if (isNaN(parsed)) {
      console.error('[check-focus] unparseable Gemini response:', JSON.stringify(raw))
      return res.status(422).json({ error: 'Unparseable Gemini response', raw })
    }
    const score = Math.max(0, Math.min(1, parsed))
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
      reason,
      distracted,
      promptTokens: usage?.promptTokenCount,
      outputTokens: usage?.candidatesTokenCount,
      finishReason,
    }))

    const verbose = req.query.verbose === '1'
    return res.json({
      score,
      raw,
      reason,
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
