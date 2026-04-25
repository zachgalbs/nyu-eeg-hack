import {
  addDays,
  setHours,
  setMinutes,
  startOfDay,
  startOfWeek,
  areIntervalsOverlapping,
} from 'date-fns';

export type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  ownerId: 'me' | string;
  ownerName: string;
  allDay?: boolean;
};

/** Demo friends' schedules for the ISO week that contains `weekContaining`. */
export function getCalendarFixture(weekContaining: Date = new Date()): CalendarEvent[] {
  const monday = startOfWeek(startOfDay(weekContaining), { weekStartsOn: 1 });

  const at = (d: number, h: number, m: number) =>
    setMinutes(setHours(addDays(monday, d), h), m);

  return [
    {
      id: 'me-1',
      title: 'Deep Work: Design System',
      start: at(0, 9, 0),
      end: at(0, 11, 0),
      ownerId: 'me',
      ownerName: 'You',
    },
    {
      id: 'sarah-1',
      title: 'Writing sprint',
      start: at(0, 9, 30),
      end: at(0, 11, 0),
      ownerId: 'sarah',
      ownerName: 'Sarah',
    },
    {
      id: 'me-2',
      title: 'Team standup',
      start: at(0, 11, 30),
      end: at(0, 12, 0),
      ownerId: 'me',
      ownerName: 'You',
    },
    {
      id: 'mike-1',
      title: 'Code review block',
      start: at(0, 11, 0),
      end: at(0, 12, 30),
      ownerId: 'mike',
      ownerName: 'Mike',
    },
    {
      id: 'me-3',
      title: 'Focus block: code review',
      start: at(0, 14, 0),
      end: at(0, 16, 0),
      ownerId: 'me',
      ownerName: 'You',
    },
    {
      id: 'alex-1',
      title: 'Pair study — algorithms',
      start: at(0, 14, 30),
      end: at(0, 15, 45),
      ownerId: 'alex',
      ownerName: 'Alex',
    },
    {
      id: 'me-4',
      title: 'Reading',
      start: at(2, 10, 0),
      end: at(2, 11, 30),
      ownerId: 'me',
      ownerName: 'You',
    },
    {
      id: 'sarah-2',
      title: 'Cafe study',
      start: at(2, 10, 45),
      end: at(2, 12, 0),
      ownerId: 'sarah',
      ownerName: 'Sarah',
    },
  ];
}

export function getFriendFixtures(weekContaining: Date = new Date()): CalendarEvent[] {
  return getCalendarFixture(weekContaining).filter((e) => e.ownerId !== 'me');
}

export function eventsForDay(day: Date, all: CalendarEvent[]): CalendarEvent[] {
  const start = startOfDay(day);
  const end = addDays(start, 1);
  return all
    .filter((e) => e.start < end && e.end > start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Friends on a different event whose interval overlaps yours (co-check-in). */
export function coClimbingNames(event: CalendarEvent, all: CalendarEvent[]): string[] {
  if (event.ownerId !== 'me') return [];
  const names = new Set<string>();
  for (const other of all) {
    if (other.id === event.id || other.ownerId === 'me') continue;
    if (
      areIntervalsOverlapping(
        { start: event.start, end: event.end },
        { start: other.start, end: other.end },
        { inclusive: true }
      )
    ) {
      names.add(other.ownerName);
    }
  }
  return [...names];
}
