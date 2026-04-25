import { addDays, startOfDay, areIntervalsOverlapping } from 'date-fns';

export type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  ownerId: 'me' | string;
  ownerName: string;
  allDay?: boolean;
};

export function eventsForDay(day: Date, all: CalendarEvent[]): CalendarEvent[] {
  const start = startOfDay(day);
  const end = addDays(start, 1);
  return all
    .filter((e) => e.start < end && e.end > start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function coClimbingNames(event: CalendarEvent, all: CalendarEvent[]): string[] {
  if (event.ownerId !== 'me') return [];
  const names = new Set<string>();
  for (const other of all) {
    if (other.id === event.id || other.ownerId === 'me') continue;
    if (
      areIntervalsOverlapping(
        { start: event.start, end: event.end },
        { start: other.start, end: other.end },
        { inclusive: true },
      )
    ) {
      names.add(other.ownerName);
    }
  }
  return [...names];
}
