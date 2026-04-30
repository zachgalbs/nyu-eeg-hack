import { GoogleGenerativeAI, type Part } from '@google/generative-ai'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { imageBase64, imageBase64b, eventName } = req.body
  if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' })

  const task = eventName ? `"${eventName}"` : 'their current task'
  const photoCount = imageBase64b ? 'two photos taken one second apart' : 'one photo'
  const prompt = `You are a focus detector. You are given ${photoCount} from a webcam that faces the person directly. The person's screen is not visible — it is below the camera.

YOUR RESPONSE MUST BE EXACTLY THIS FORMAT — nothing else:
<number between 0 and 1> | <what you see in 8 words or less>

SCORING:
0 = focused (eyes toward camera/screen area, or looking down at desk/notebook)
1 = distracted (eyes clearly to the side, on phone, left the frame, or asleep)

Task context: working on ${task}

REQUIRED OUTPUT FORMAT (you MUST include the pipe character and reason):
0 | eyes on camera
0 | looking down at notebook
0.8 | eyes drifting to the right
1 | looking at phone
1 | no person visible

Your response (number | reason):`

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const imageParts: Part[] = [
      { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
    ]
    if (imageBase64b) {
      imageParts.push({ inlineData: { data: imageBase64b, mimeType: 'image/jpeg' } })
    }

    const result = await model.generateContent([...imageParts, prompt])

    const raw = result.response.text().trim()
    // Accept "SCORE | REASON" anywhere in the response (model sometimes adds preamble)
    const pipeMatch = raw.match(/([01](?:\.\d+)?)\s*\|\s*(.+)/)
    const reason = pipeMatch ? pipeMatch[2].trim() : ''
    const scoreStr = pipeMatch ? pipeMatch[1] : raw
    const bareMatch = !pipeMatch ? scoreStr.match(/([01](?:\.\d+)?)/) : null
    const parsed = pipeMatch ? parseFloat(pipeMatch[1]) : (bareMatch ? parseFloat(bareMatch[1]) : NaN)
    if (isNaN(parsed)) {
      console.error('[check-focus] unparseable Gemini response:', JSON.stringify(raw))
      return res.status(422).json({ error: 'Unparseable Gemini response', raw })
    }
    if (!reason) {
      console.warn('[check-focus] Gemini skipped reason, raw:', JSON.stringify(raw))
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
