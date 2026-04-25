import { startOfWeek, addDays, startOfDay, endOfDay } from 'date-fns';
import type { CalendarEvent } from '../data/calendarFixtures';

interface GoogleEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

export class AuthError extends Error {}

export async function fetchMyEventsThisWeek(
  token: string,
  weekContaining: Date,
): Promise<CalendarEvent[]> {
  const monday = startOfWeek(startOfDay(weekContaining), { weekStartsOn: 1 });
  const sunday = addDays(monday, 7);

  const params = new URLSearchParams({
    timeMin: monday.toISOString(),
    timeMax: sunday.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (res.status === 401) throw new AuthError('Token expired');
  if (!res.ok) throw new Error(`Calendar API error ${res.status}`);

  const data = await res.json();
  const items: GoogleEvent[] = data.items ?? [];

  return items.map((e): CalendarEvent => {
    const allDay = !e.start.dateTime;
    const start = allDay
      ? startOfDay(new Date(e.start.date!))
      : new Date(e.start.dateTime!);
    const end = allDay
      ? endOfDay(new Date(e.start.date!))
      : new Date(e.end.dateTime!);
    return {
      id: e.id,
      title: e.summary ?? '(no title)',
      start,
      end,
      ownerId: 'me' as const,
      ownerName: 'You',
      allDay,
    };
  });
}
