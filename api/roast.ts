import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

type RoastPayload = {
  userName?: string;
  userBlock?: string;
  friendName?: string;
  friendActivity?: string;
  minutesIn?: number;
  trigger?: 'auto' | 'friend_throw';
};

function fallbackRoast(payload: RoastPayload) {
  const user = payload.userName || 'you';
  const friend = payload.friendName || 'your friend';
  const block = payload.userBlock || 'this block';
  const minutes = Math.max(1, Math.floor(payload.minutesIn || 0));
  if (payload.trigger === 'friend_throw') {
    return `${friend} clocked your drift in ${block}. Lock in for the next ${Math.min(15, minutes + 5)} minutes and climb back.`;
  }
  return `${user}, you're slipping in ${block}. Own the next ${Math.min(15, minutes + 5)} minutes and stop feeding distractions.`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const payload = (req.body ?? {}) as RoastPayload;
  if (!payload.userBlock) {
    return res.status(400).json({ error: 'Missing userBlock' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({ roast: fallbackRoast(payload), source: 'fallback' });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const prompt = [
      'Write exactly 1-2 short roast lines for a study accountability app.',
      'Constraints: behavior-only, no identity attacks, no profanity.',
      `Trigger: ${payload.trigger || 'auto'}`,
      `Student: ${payload.userName || 'user'}`,
      `Current block: ${payload.userBlock}`,
      `Minutes in block: ${Math.max(1, Math.floor(payload.minutesIn || 0))}`,
      `Friend: ${payload.friendName || 'friend'}`,
      `Friend context: ${payload.friendActivity || 'studying'}`,
      'Output plain text only.',
    ].join('\n');

    const message = await client.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 90,
      temperature: 0.8,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content
      .filter((chunk): chunk is { type: 'text'; text: string } => chunk.type === 'text')
      .map((chunk) => chunk.text)
      .join(' ')
      .trim();

    if (!text) return res.json({ roast: fallbackRoast(payload), source: 'fallback' });
    return res.json({ roast: text, source: 'anthropic' });
  } catch (error) {
    console.error('[roast]', error);
    return res.json({ roast: fallbackRoast(payload), source: 'fallback' });
  }
}
