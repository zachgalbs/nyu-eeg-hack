import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { getUserIdFromRequest } from '../_lib/session';
import { getValidAccessToken, TokenRefreshError } from '../_lib/google-token';
import { classifyTitles, normalizeTitle } from '../_lib/classify';

interface GoogleEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? '');
  switch (action) {
    case 'events': return handleEvents(req, res);
    case 'override': return handleOverride(req, res);
    default: return res.status(404).json({ error: 'Unknown action' });
  }
}

async function handleEvents(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Not signed in' });

  const from = (req.query.from as string) || new Date().toISOString();
  const to =
    (req.query.to as string) ||
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(userId);
  } catch (err) {
    if (err instanceof TokenRefreshError) {
      return res.status(401).json({ error: 'Reconnect Google Calendar' });
    }
    throw err;
  }

  const params = new URLSearchParams({
    timeMin: from,
    timeMax: to,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });

  const apiRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (apiRes.status === 401) {
    return res.status(401).json({ error: 'Reconnect Google Calendar' });
  }
  if (!apiRes.ok) {
    return res.status(502).json({ error: `Calendar API error ${apiRes.status}` });
  }

  const data = await apiRes.json();
  const items: GoogleEvent[] = data.items ?? [];

  const titles = items.map((e) => e.summary ?? '(no title)');
  const classifications = await classifyTitles(titles, userId);

  const events = items.map((e) => {
    const title = e.summary ?? '(no title)';
    const cls = classifications.get(normalizeTitle(title)) ?? {
      isAcademic: false,
      subject: null,
    };
    return {
      id: e.id,
      title,
      start: e.start.dateTime ?? e.start.date,
      end: e.end.dateTime ?? e.end.date,
      allDay: !e.start.dateTime,
      isAcademic: cls.isAcademic,
      subject: cls.subject,
    };
  });

  res.json({ events });
}

async function handleOverride(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Not signed in' });

  const { title, isAcademic, subject } = req.body ?? {};
  if (typeof title !== 'string' || typeof isAcademic !== 'boolean') {
    return res.status(400).json({ error: 'Bad payload' });
  }
  const norm = normalizeTitle(title);
  if (!norm) return res.status(400).json({ error: 'Empty title' });

  await sql`
    INSERT INTO event_classification_overrides (user_id, title_norm, is_academic, subject, updated_at)
    VALUES (${userId}, ${norm}, ${isAcademic}, ${subject ?? null}, NOW())
    ON CONFLICT (user_id, title_norm) DO UPDATE
      SET is_academic = EXCLUDED.is_academic,
          subject = EXCLUDED.subject,
          updated_at = NOW()
  `;

  res.json({ ok: true });
}
