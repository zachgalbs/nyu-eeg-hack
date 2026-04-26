import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { format, startOfDay } from 'date-fns';
import { eventsForDay, coClimbingNames, type CalendarEvent } from '../../data/calendarFixtures';
import { getWeeklyCommitmentSummary, setBuddyCommitment } from '../../lib/compcal-state';
import { getGoogleToken } from '../../lib/auth';
import { fetchMyEventsThisWeek, AuthError } from '../../lib/googleCalendar';

function formatRange(e: CalendarEvent) {
  return `${format(e.start, 'h:mm a')} – ${format(e.end, 'h:mm a')}`;
}

function durationMinutes(e: CalendarEvent) {
  return Math.max(1, Math.round((e.end.getTime() - e.start.getTime()) / 60000));
}

export function CalendarScreen() {
  const navigate = useNavigate();
  const today = useMemo(() => startOfDay(new Date()), []);
  const token = getGoogleToken();

  const startSession = (event: CalendarEvent) => {
    navigate(`/mountain/${event.id}`, {
      state: { title: event.title, duration: durationMinutes(event), playMeetUp: true },
    });
  };

  const [myEvents, setMyEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(!!token);
  const [authError, setAuthError] = useState(false);
  const [buddyPickByEvent, setBuddyPickByEvent] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;
    fetchMyEventsThisWeek(token, new Date())
      .then((events) => { setMyEvents(events); setLoading(false); })
      .catch((err) => {
        if (err instanceof AuthError) setAuthError(true);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dayEvents = eventsForDay(today, myEvents);
  const mine = dayEvents.filter((e) => e.ownerId === 'me');
  const others = dayEvents.filter((e) => e.ownerId !== 'me');
  const weekly = useMemo(() => getWeeklyCommitmentSummary(), []);
  const plannedTodayMinutes = useMemo(
    () => mine.reduce((sum, e) => sum + durationMinutes(e), 0),
    [mine],
  );
  const buddyOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of others) {
      if (!map.has(e.ownerId)) map.set(e.ownerId, e.ownerName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [others]);

  const startWithBuddy = (event: CalendarEvent) => {
    const selectedBuddyId = buddyPickByEvent[event.id] ?? buddyOptions[0]?.id;
    const selectedBuddy = buddyOptions.find((o) => o.id === selectedBuddyId);
    if (selectedBuddy) {
      setBuddyCommitment({
        buddyId: selectedBuddy.id,
        buddyName: selectedBuddy.name,
        eventId: event.id,
        eventTitle: event.title,
        createdAt: new Date().toISOString(),
      });
    }
    startSession(event);
  };

  const authBanner = !token ? (
    <div
      className="mb-6 flex items-start gap-4 border border-terracotta/40 bg-card p-4"
      style={{ borderRadius: '14px' }}
    >
      <div className="flex-1">
        <p className="mb-1 font-semibold text-ink" style={{ fontSize: '14px' }}>Connect Google Calendar</p>
        <p className="text-warm-gray" style={{ fontSize: '13px' }}>Sign in with Google to see your real events.</p>
      </div>
      <a
        href="/api/auth/login"
        className="shrink-0 rounded-full bg-primary px-4 py-2 text-primary-foreground transition-opacity hover:opacity-90"
        style={{ fontSize: '13px', fontWeight: 600 }}
      >
        Connect
      </a>
    </div>
  ) : authError ? (
    <div
      className="mb-6 flex items-start gap-4 border border-coral/40 bg-card p-4"
      style={{ borderRadius: '14px' }}
    >
      <div className="flex-1">
        <p className="mb-1 font-semibold text-ink" style={{ fontSize: '14px' }}>Session expired</p>
        <p className="text-warm-gray" style={{ fontSize: '13px' }}>Reconnect to sync your calendar.</p>
      </div>
      <a
        href="/api/auth/login"
        className="shrink-0 rounded-full bg-primary px-4 py-2 text-primary-foreground transition-opacity hover:opacity-90"
        style={{ fontSize: '13px', fontWeight: 600 }}
      >
        Reconnect
      </a>
    </div>
  ) : null;

  return (
    <div className="px-4 pb-6 pt-10 sm:px-6">
      <header className="mb-6">
        <h1 className="mb-1 text-ink" style={{ fontFamily: 'var(--font-serif)', fontSize: '32px' }}>
          Calendar
        </h1>
        <p className="text-warm-gray" style={{ fontSize: '13px' }}>
          {format(today, 'EEEE, MMMM d')}
        </p>
      </header>

      {authBanner}

      <section className="mb-6 rounded-2xl border border-border bg-card/85 p-4 sm:p-5">
        <p className="mb-3 text-[11px] uppercase tracking-wide text-warm-gray">Study load</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background-solid/50 p-3">
            <p className="text-[11px] text-warm-gray">Planned today</p>
            <p className="text-lg font-semibold text-ink">{plannedTodayMinutes}m</p>
          </div>
          <div className="rounded-xl border border-border bg-background-solid/50 p-3">
            <p className="text-[11px] text-warm-gray">Focused this week</p>
            <p className="text-lg font-semibold text-ink">
              {Math.floor(weekly.totalFocusedMinutes / 60)}h {weekly.totalFocusedMinutes % 60}m
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background-solid/50 p-3">
            <p className="text-[11px] text-warm-gray">Sessions this week</p>
            <p className="text-lg font-semibold text-ink">{weekly.completedSessions}</p>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="animate-pulse border border-border bg-card p-5" style={{ borderRadius: '16px' }}>
              <div className="mb-2 h-5 w-3/5 rounded bg-mountain/30" />
              <div className="mb-4 h-3 w-2/5 rounded bg-mountain/20" />
              <div className="h-10 rounded-full bg-mountain/20" />
            </div>
          ))}
        </div>
      ) : mine.length === 0 ? (
        <div
          className="border border-border bg-card p-8 text-center"
          style={{ borderRadius: '16px', boxShadow: 'var(--shadow-card)' }}
        >
          <p className="text-warm-gray" style={{ fontSize: '15px' }}>
            {token ? 'Nothing scheduled today.' : 'Connect Google Calendar to see your events.'}
          </p>
          {token && (
            <p className="mt-1 text-warm-gray" style={{ fontSize: '13px' }}>
              Add a study block to your Google Calendar to start a climb.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {mine.map((event) => {
            const peers = coClimbingNames(event, myEvents);
            return (
              <div
                key={event.id}
                className="border border-border bg-card p-5 sm:p-6"
                style={{ borderRadius: '16px', boxShadow: 'var(--shadow-card)' }}
              >
                <h3 className="mb-1 text-ink" style={{ fontSize: '20px', fontWeight: 600 }}>
                  {event.title}
                </h3>
                <p
                  className="mb-1 text-warm-gray"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}
                >
                  {formatRange(event)}
                </p>
                <p className="mb-3 text-xs text-moss">{durationMinutes(event)} minutes planned</p>
                {peers.length > 0 && (
                  <p
                    className="mb-4 border-l-4 border-moss bg-mountain/5 py-2 pl-3 text-ink"
                    style={{ fontSize: '13px' }}
                  >
                    Climbing with {peers.join(', ')}
                  </p>
                )}
                {buddyOptions.length > 0 ? (
                  <div className="mb-3 rounded-xl border border-border bg-background-solid/40 p-3">
                    <p className="mb-2 text-[12px] text-warm-gray">Mutual support check-in (optional)</p>
                    <select
                      value={buddyPickByEvent[event.id] ?? buddyOptions[0].id}
                      onChange={(e) =>
                        setBuddyPickByEvent((prev) => ({ ...prev, [event.id]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-sm text-foreground outline-none focus:border-moss"
                    >
                      {buddyOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className={`grid gap-2 ${buddyOptions.length > 0 ? 'sm:grid-cols-2' : ''}`}>
                  <button
                    type="button"
                    onClick={() => startSession(event)}
                    className={`w-full py-3 transition-opacity hover:opacity-90 ${
                      buddyOptions.length > 0
                        ? 'border border-border bg-card text-foreground'
                        : 'bg-primary text-primary-foreground'
                    }`}
                    style={{ borderRadius: '999px', fontWeight: 600 }}
                  >
                    {buddyOptions.length > 0 ? 'Start solo' : 'Start session'}
                  </button>
                  {buddyOptions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => startWithBuddy(event)}
                      className="w-full bg-primary py-3 text-primary-foreground transition-opacity hover:opacity-90"
                      style={{ borderRadius: '999px', fontWeight: 600 }}
                    >
                      Start with buddy
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {others.length > 0 && (
            <div>
              <p className="mb-2 text-warm-gray" style={{ fontSize: '13px' }}>Friends on the mountain today</p>
              <ul className="space-y-2">
                {others.map((event) => (
                  <li
                    key={event.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 border border-border bg-card/80 px-4 py-3"
                    style={{ borderRadius: '12px' }}
                  >
                    <span className="font-semibold text-ink">{event.ownerName}</span>
                    <span className="text-ink" style={{ fontSize: '15px' }}>{event.title}</span>
                    <span className="w-full text-warm-gray sm:w-auto" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                      {formatRange(event)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
