import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  addDays,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import {
  coClimbingNames,
  eventsForDay,
  getCalendarFixture,
  getFriendFixtures,
  type CalendarEvent,
} from '../../data/calendarFixtures';
import { getGoogleToken } from '../../lib/auth';
import { fetchMyEventsThisWeek, AuthError } from '../../lib/googleCalendar';

type View = 'today' | 'week';

function formatRange(e: CalendarEvent) {
  return `${format(e.start, 'h:mm a')} – ${format(e.end, 'h:mm a')}`;
}

function isHappening(e: CalendarEvent, now: Date) {
  return !e.allDay && e.start <= now && now <= e.end;
}

export function CalendarScreen() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('today');
  const [now, setNow] = useState(() => new Date());
  const today = startOfDay(now);

  // Refresh "now" every 60 seconds so active-session detection stays current
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Week view state
  const [selected, setSelected] = useState(() => today);
  const token = getGoogleToken();

  const weekStart = useMemo(
    () => startOfWeek(startOfDay(selected), { weekStartsOn: 1 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected.toISOString()],
  );
  const weekKey = weekStart.toISOString();

  const fixtureMyEvents = useMemo(
    () => getCalendarFixture(selected).filter((e) => e.ownerId === 'me'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekKey],
  );

  const [myEvents, setMyEvents] = useState<CalendarEvent[]>(fixtureMyEvents);
  const [loading, setLoading] = useState(!!token);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setAuthError(false);
    fetchMyEventsThisWeek(token, selected)
      .then((events) => { setMyEvents(events); setLoading(false); })
      .catch((err) => {
        if (err instanceof AuthError) setAuthError(true);
        else setMyEvents(fixtureMyEvents);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey]);

  const friendEvents = useMemo(() => getFriendFixtures(selected), [weekKey]);
  const allEvents = useMemo(() => [...myEvents, ...friendEvents], [myEvents, friendEvents]);

  // Today view data
  const todayAllEvents = eventsForDay(today, allEvents);
  const todayMine = todayAllEvents.filter((e) => e.ownerId === 'me');
  const todayMineTimed = todayMine.filter((e) => !e.allDay);
  const todayMineAllDay = todayMine.filter((e) => e.allDay);
  const todayOthers = todayAllEvents.filter((e) => e.ownerId !== 'me');
  const activeEvent = todayMineTimed.find((e) => isHappening(e, now)) ?? null;

  // Week view data
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekKey],
  );
  const dayEvents = eventsForDay(selected, allEvents);
  const mine = dayEvents.filter((e) => e.ownerId === 'me');
  const others = dayEvents.filter((e) => e.ownerId !== 'me');

  const authBanner = !token ? (
    <div
      className="mb-6 flex items-start gap-4 border border-terracotta/40 bg-card p-4"
      style={{ borderRadius: '14px' }}
    >
      <div className="flex-1">
        <p className="mb-1 font-semibold text-ink" style={{ fontSize: '14px' }}>Connect Google Calendar</p>
        <p className="text-warm-gray" style={{ fontSize: '13px' }}>See your real events — demo data shown for now.</p>
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
      </header>

      {authBanner}

      {/* Tab bar */}
      <div className="mb-6 flex gap-2">
        {(['today', 'week'] as View[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`px-5 py-2 border transition-colors ${
              view === v
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-warm-gray hover:bg-card/80'
            }`}
            style={{ borderRadius: '999px', fontSize: '14px', fontWeight: 600 }}
          >
            {v === 'today' ? 'Today' : 'Week'}
          </button>
        ))}
      </div>

      {view === 'today' && (
        <div>
          <h2 className="mb-5 text-ink" style={{ fontFamily: 'var(--font-serif)', fontSize: '22px' }}>
            {format(today, 'EEEE, MMMM d')}
          </h2>

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((n) => (
                <div key={n} className="animate-pulse border border-border bg-card p-5" style={{ borderRadius: '16px' }}>
                  <div className="mb-2 h-5 w-3/5 rounded bg-mountain/30" />
                  <div className="mb-4 h-3 w-2/5 rounded bg-mountain/20" />
                  <div className="h-10 rounded-full bg-mountain/20" />
                </div>
              ))}
            </div>
          ) : todayMine.length === 0 ? (
            <div className="border border-border bg-card p-8 text-center" style={{ borderRadius: '16px' }}>
              <p className="text-warm-gray" style={{ fontSize: '15px' }}>Nothing scheduled today.</p>
              <p className="mt-1 text-warm-gray" style={{ fontSize: '13px' }}>Add a block to your Google Calendar to start a climb.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeEvent && (
                <div
                  className="border-2 border-moss bg-card p-5"
                  style={{ borderRadius: '16px', boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-moss animate-pulse" />
                    <span className="text-moss" style={{ fontSize: '12px', fontWeight: 600 }}>HAPPENING NOW</span>
                  </div>
                  <h3 className="mb-1 text-ink" style={{ fontSize: '22px', fontWeight: 600 }}>{activeEvent.title}</h3>
                  <p className="mb-4 text-warm-gray" style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
                    {formatRange(activeEvent)}
                  </p>
                  {coClimbingNames(activeEvent, allEvents).length > 0 && (
                    <p className="mb-4 border-l-4 border-moss bg-mountain/5 py-2 pl-3 text-ink" style={{ fontSize: '13px' }}>
                      Climbing with {coClimbingNames(activeEvent, allEvents).join(', ')}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/mountain/${activeEvent.id}`, { state: { title: activeEvent.title } })}
                    className="w-full bg-moss py-3 text-white transition-opacity hover:opacity-90"
                    style={{ borderRadius: '999px', fontWeight: 600, fontSize: '16px' }}
                  >
                    Check in
                  </button>
                </div>
              )}

              {todayMineTimed.filter((e) => !isHappening(e, now)).map((event) => {
                const upcoming = event.start > now;
                return (
                  <div
                    key={event.id}
                    className="border border-border bg-card p-4 opacity-70"
                    style={{ borderRadius: '16px' }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-ink" style={{ fontSize: '16px', fontWeight: 600 }}>{event.title}</h3>
                      <span
                        className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${upcoming ? 'bg-mountain/10 text-warm-gray' : 'bg-border text-warm-gray'}`}
                      >
                        {upcoming ? `Starts ${format(event.start, 'h:mm a')}` : 'Ended'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-warm-gray" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                      {formatRange(event)}
                    </p>
                  </div>
                );
              })}

              {!activeEvent && todayMineTimed.length > 0 && (
                <p className="pt-1 text-center text-warm-gray" style={{ fontSize: '13px' }}>
                  No session in progress right now.
                </p>
              )}

              {todayMineAllDay.length > 0 && (
                <div className="mt-2">
                  <p className="mb-2 text-warm-gray" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>All day</p>
                  <div className="space-y-2">
                    {todayMineAllDay.map((event) => (
                      <div
                        key={event.id}
                        className="border border-border bg-card p-4 flex items-center justify-between gap-3"
                        style={{ borderRadius: '16px' }}
                      >
                        <span className="text-ink" style={{ fontSize: '15px', fontWeight: 600 }}>{event.title}</span>
                        <button
                          type="button"
                          onClick={() => navigate(`/mountain/${event.id}`, { state: { title: event.title } })}
                          className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-primary-foreground transition-opacity hover:opacity-90"
                          style={{ fontSize: '13px', fontWeight: 600 }}
                        >
                          Check in
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {todayOthers.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-warm-gray" style={{ fontSize: '13px' }}>Friends on the mountain today</p>
                  <ul className="space-y-2">
                    {todayOthers.map((event) => (
                      <li
                        key={event.id}
                        className="flex flex-wrap items-baseline justify-between gap-2 border border-border bg-card/80 px-4 py-3"
                        style={{ borderRadius: '12px' }}
                      >
                        <span className="font-semibold text-ink">{event.ownerName}</span>
                        <span className="text-ink" style={{ fontSize: '14px' }}>{event.title}</span>
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
      )}

      {view === 'week' && (
        <div className="lg:grid lg:grid-cols-[minmax(0,280px)_1fr] lg:gap-10">
          <div>
            <p className="mb-3 text-warm-gray" style={{ fontSize: '13px', fontWeight: 600 }}>This week</p>
            <div className="flex gap-2 overflow-x-auto pb-2 lg:grid lg:grid-cols-1 lg:overflow-visible lg:pb-0">
              {weekDays.map((d) => {
                const isSel = isSameDay(d, selected);
                const count = eventsForDay(d, allEvents).length;
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    onClick={() => setSelected(startOfDay(d))}
                    className={`min-w-[4.5rem] shrink-0 rounded-2xl border px-3 py-3 text-left transition-colors lg:min-w-0 lg:px-4 ${
                      isSel
                        ? 'border-terracotta bg-card shadow-[var(--shadow-card)]'
                        : 'border-border bg-card/60 hover:bg-card'
                    }`}
                  >
                    <div className="text-warm-gray" style={{ fontSize: '11px' }}>{format(d, 'EEE')}</div>
                    <div className="text-ink" style={{ fontSize: '18px', fontWeight: 600 }}>{format(d, 'd')}</div>
                    {count > 0 && (
                      <div className="mt-1 text-moss" style={{ fontSize: '11px' }}>{count} block{count === 1 ? '' : 's'}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-ink" style={{ fontFamily: 'var(--font-serif)', fontSize: '20px' }}>
              {format(selected, 'EEEE, MMMM d')}
            </h2>

            {loading ? (
              <div className="space-y-4">
                {[1, 2].map((n) => (
                  <div key={n} className="animate-pulse border border-border bg-card p-5" style={{ borderRadius: '16px' }}>
                    <div className="mb-2 h-5 w-3/5 rounded bg-mountain/30" />
                    <div className="mb-4 h-3 w-2/5 rounded bg-mountain/20" />
                    <div className="h-10 rounded-full bg-mountain/20" />
                  </div>
                ))}
              </div>
            ) : mine.length === 0 && others.length === 0 ? (
              <div className="border border-border bg-card p-8 text-center" style={{ borderRadius: '16px' }}>
                <p className="text-warm-gray" style={{ fontSize: '15px' }}>Nothing scheduled this day.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {mine.map((event) => {
                  const peers = coClimbingNames(event, allEvents);
                  const active = isSameDay(selected, today) && isHappening(event, now);
                  return (
                    <div
                      key={event.id}
                      className="border border-border bg-card p-5 sm:p-6"
                      style={{ borderRadius: '16px', boxShadow: 'var(--shadow-card)' }}
                    >
                      <h3 className="mb-1 text-ink" style={{ fontSize: '20px', fontWeight: 600 }}>{event.title}</h3>
                      <p className="mb-3 text-warm-gray" style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
                        {formatRange(event)}
                      </p>
                      {peers.length > 0 && (
                        <p className="mb-4 border-l-4 border-moss bg-mountain/5 py-2 pl-3 text-ink" style={{ fontSize: '13px' }}>
                          Climbing with {peers.join(', ')}
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={!active}
                        onClick={() => navigate(`/mountain/${event.id}`, { state: { title: event.title } })}
                        className={`w-full py-3 transition-opacity ${active ? 'bg-primary text-primary-foreground hover:opacity-90' : 'bg-border text-warm-gray cursor-not-allowed'}`}
                        style={{ borderRadius: '999px', fontWeight: 600 }}
                      >
                        {active ? 'Check in' : isSameDay(selected, today) && event.start > now ? `Starts ${format(event.start, 'h:mm a')}` : 'Start studying'}
                      </button>
                    </div>
                  );
                })}

                {others.length > 0 && (
                  <div>
                    <p className="mb-2 text-warm-gray" style={{ fontSize: '13px' }}>Friends on the mountain (same day)</p>
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
        </div>
      )}
    </div>
  );
}
