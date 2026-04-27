import { startOfWeek, addDays, startOfDay, endOfDay } from 'date-fns';
import type { CalendarEvent } from '../data/calendarFixtures';

interface ApiEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  isAcademic: boolean;
  subject: string | null;
}

export class AuthError extends Error {}

/**
 * Fetches events for the ISO week containing `weekContaining` from our
 * server-side proxy. The proxy keeps the Google access token server-side
 * and refreshes it automatically — clients never see/store it.
 */
export async function fetchMyEventsThisWeek(
  weekContaining: Date,
): Promise<CalendarEvent[]> {
  const monday = startOfWeek(startOfDay(weekContaining), { weekStartsOn: 1 });
  const sunday = addDays(monday, 7);

  const params = new URLSearchParams({
    from: monday.toISOString(),
    to: sunday.toISOString(),
  });

  const res = await fetch(`/api/calendar/events?${params}`, {
    credentials: 'same-origin',
  });

  if (res.status === 401) throw new AuthError('Reconnect Google Calendar');
  if (!res.ok) throw new Error(`Calendar proxy error ${res.status}`);

  const data = (await res.json()) as { events: ApiEvent[] };

  return data.events.map((e): CalendarEvent => {
    const start = e.allDay ? startOfDay(new Date(e.start)) : new Date(e.start);
    const end = e.allDay ? endOfDay(new Date(e.start)) : new Date(e.end);
    return {
      id: e.id,
      title: e.title,
      start,
      end,
      ownerId: 'me' as const,
      ownerName: 'You',
      allDay: e.allDay,
      isAcademic: e.isAcademic,
      subject: e.subject,
    };
  });
}

/** Override classification for a given event title. */
export async function setClassificationOverride(
  title: string,
  isAcademic: boolean,
  subject: string | null = null,
): Promise<void> {
  const res = await fetch('/api/calendar/override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ title, isAcademic, subject }),
  });
  if (!res.ok) throw new Error(`Override failed ${res.status}`);
}
