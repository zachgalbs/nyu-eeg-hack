import { useMemo } from 'react';
import { format } from 'date-fns';
import type { CalendarEvent } from '../../data/calendarFixtures';
import { getSessionOutcomes } from '../../lib/compcal-state';

type Props = {
  events: CalendarEvent[];
  /** Day this rollup represents — used to filter sessions to that day. */
  day: Date;
};

function durationMinutes(e: CalendarEvent) {
  return Math.max(1, Math.round((e.end.getTime() - e.start.getTime()) / 60000));
}

function fmtHm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Groups academic events by subject and shows planned/actual minutes plus
 * average focus score per subject. Events without an academic classification
 * are surfaced under "Unclassified" so nothing silently disappears.
 */
export function SubjectRollup({ events, day }: Props) {
  const sessions = useMemo(() => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return getSessionOutcomes().filter((s) => {
      const t = new Date(s.completedAt).getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime();
    });
  }, [day]);

  const groups = useMemo(() => {
    const academic = events.filter((e) => e.isAcademic);
    const byEventId = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const arr = byEventId.get(s.eventId) ?? [];
      arr.push(s);
      byEventId.set(s.eventId, arr);
    }
    const map = new Map<
      string,
      {
        subject: string;
        events: { event: CalendarEvent; planned: number; actual: number; focus: number | null }[];
        plannedTotal: number;
        actualTotal: number;
        avgFocus: number | null;
      }
    >();
    for (const e of academic) {
      const key = e.subject ?? 'Unclassified';
      const planned = durationMinutes(e);
      const eventSessions = byEventId.get(e.id) ?? [];
      const actual = eventSessions.reduce((sum, s) => sum + s.completedMinutes, 0);
      const focusScores = eventSessions.map((s) => s.focusScore).filter((n) => n > 0);
      const focus = focusScores.length
        ? Math.round(focusScores.reduce((a, b) => a + b, 0) / focusScores.length)
        : null;
      const g = map.get(key) ?? {
        subject: key,
        events: [],
        plannedTotal: 0,
        actualTotal: 0,
        avgFocus: null,
      };
      g.events.push({ event: e, planned, actual, focus });
      g.plannedTotal += planned;
      g.actualTotal += actual;
      map.set(key, g);
    }
    // Compute group-level avg focus
    for (const g of map.values()) {
      const scored = g.events.map((x) => x.focus).filter((n): n is number => n != null);
      g.avgFocus = scored.length
        ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
        : null;
    }
    return [...map.values()].sort((a, b) => b.plannedTotal - a.plannedTotal);
  }, [events, sessions]);

  if (groups.length === 0) {
    return (
      <div className="border border-border bg-card p-6 text-center" style={{ borderRadius: '16px' }}>
        <p className="text-warm-gray" style={{ fontSize: '14px' }}>
          No academic events for {format(day, 'MMM d')}.
        </p>
        <p className="mt-1 text-warm-gray" style={{ fontSize: '12px' }}>
          Add a study block (lecture, problem set, exam prep) to your calendar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div
          key={g.subject}
          className="border border-border bg-card p-4"
          style={{ borderRadius: '16px' }}
        >
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="text-ink" style={{ fontSize: '18px', fontWeight: 600 }}>
              {g.subject}
            </h3>
            <div className="flex items-baseline gap-3">
              <span className="text-ink" style={{ fontSize: '15px', fontWeight: 600 }}>
                {fmtHm(g.actualTotal || g.plannedTotal)}
              </span>
              {g.avgFocus != null && (
                <span className="text-moss" style={{ fontSize: '12px' }}>
                  focus {g.avgFocus}
                </span>
              )}
            </div>
          </div>
          <ul className="space-y-1.5">
            {g.events.map(({ event, planned, actual, focus }) => (
              <li
                key={event.id}
                className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
              >
                <span className="text-warm-gray" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                  {format(event.start, 'h:mm a')}
                </span>
                <span className="flex-1 text-ink">{event.title}</span>
                <span className="text-warm-gray" style={{ fontSize: '12px' }}>
                  {actual > 0 ? `${actual}m / ${planned}m` : `${planned}m`}
                  {focus != null && ` • ${focus}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
