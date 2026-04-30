import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { addDays, format, isSameDay, startOfDay, startOfWeek } from 'date-fns';
import { eventsForDay, coClimbingNames, type CalendarEvent } from '../../data/calendarFixtures';
import { setBuddyCommitment } from '../../lib/compcal-state';
import { isSignedIn } from '../../lib/auth';
import {
  fetchMyEventsThisWeek,
  setClassificationOverride,
  AuthError,
} from '../../lib/googleCalendar';
import { SubjectRollup } from './SubjectRollup';

type View = 'list' | 'subjects';

function formatRange(e: CalendarEvent) {
  return `${format(e.start, 'h:mm a')} – ${format(e.end, 'h:mm a')}`;
}

function durationMinutes(e: CalendarEvent) {
  return Math.max(1, Math.round((e.end.getTime() - e.start.getTime()) / 60000));
}

export function CalendarScreen() {
  const navigate = useNavigate();
  const today = useMemo(() => startOfDay(new Date()), []);
  const signedIn = isSignedIn();

  // Selected day — drives both the visible list and which week we fetch.
  const [selected, setSelected] = useState<Date>(today);
  const [view, setView] = useState<View>('list');

  const weekKey = useMemo(
    () => startOfWeek(selected, { weekStartsOn: 1 }).toISOString(),
    [selected],
  );

  const [myEvents, setMyEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(signedIn);
  const [authError, setAuthError] = useState(false);
  const [buddyPickByEvent, setBuddyPickByEvent] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!signedIn) return;
    setLoading(true);
    setAuthError(false);
    fetchMyEventsThisWeek(selected)
      .then((events) => {
        setMyEvents(events);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof AuthError) setAuthError(true);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey, signedIn]);

  const startSession = (event: CalendarEvent) => {
    navigate(`/mountain/${event.id}`, {
      state: { title: event.title, duration: durationMinutes(event), playMeetUp: true },
    });
  };

  // Apply local overrides over server classification so the UI updates
  // immediately when a user toggles a title.
  const classifiedEvents = useMemo(
    () =>
      myEvents.map((e) =>
        e.title in overrides ? { ...e, isAcademic: overrides[e.title] } : e,
      ),
    [myEvents, overrides],
  );

  const dayEvents = eventsForDay(selected, classifiedEvents);
  const mine = dayEvents.filter((e) => e.ownerId === 'me');
  const academicMine = mine.filter((e) => e.isAcademic);
  const otherMine = mine.filter((e) => !e.isAcademic);
  const others = dayEvents.filter((e) => e.ownerId !== 'me');

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

  const toggleAcademic = async (event: CalendarEvent) => {
    const next = !(event.isAcademic ?? false);
    setOverrides((prev) => ({ ...prev, [event.title]: next }));
    try {
      await setClassificationOverride(event.title, next, event.subject ?? null);
    } catch {
      /* best-effort — local state already updated */
    }
  };

  const isToday = isSameDay(selected, today);
  const goPrev = () => setSelected((d) => startOfDay(addDays(d, -1)));
  const goNext = () => setSelected((d) => startOfDay(addDays(d, 1)));
  const goToday = () => setSelected(today);

  const authBanner = !signedIn ? (
    <div
      className="mb-6 flex items-start gap-4 border border-terracotta/40 bg-card p-4"
      style={{ borderRadius: '14px' }}
    >
      <div className="flex-1">
        <p className="mb-1 font-semibold text-ink" style={{ fontSize: '14px' }}>Connect Google Calendar</p>
        <p className="text-warm-gray" style={{ fontSize: '13px' }}>Sign in once — we'll keep you connected.</p>
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
        <p className="mb-1 font-semibold text-ink" style={{ fontSize: '14px' }}>Reconnect Google Calendar</p>
        <p className="text-warm-gray" style={{ fontSize: '13px' }}>Your access was revoked or expired.</p>
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

        {/* Day navigator: < [date] > with a Today shortcut when off-day */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous day"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-warm-gray hover:bg-card/80"
            style={{ fontSize: '14px' }}
          >
            ‹
          </button>
          <p className="flex-1 text-warm-gray" style={{ fontSize: '13px' }}>
            {isToday ? 'Today, ' : ''}{format(selected, 'EEEE, MMM d')}
          </p>
          {!isToday && (
            <button
              type="button"
              onClick={goToday}
              className="rounded-full border border-primary/40 bg-card px-3 py-1.5 text-primary hover:bg-primary/5"
              style={{ fontSize: '12px', fontWeight: 600 }}
            >
              Today
            </button>
          )}
          <button
            type="button"
            onClick={goNext}
            aria-label="Next day"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-warm-gray hover:bg-card/80"
            style={{ fontSize: '14px' }}
          >
            ›
          </button>
        </div>
      </header>

      {authBanner}

      {/* List / Subjects toggle */}
      <div className="mb-4 flex gap-2">
        {(['list', 'subjects'] as View[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`px-4 py-1.5 border transition-colors ${
              view === v
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-warm-gray hover:bg-card/80'
            }`}
            style={{ borderRadius: '999px', fontSize: '13px', fontWeight: 600 }}
          >
            {v === 'list' ? 'List' : 'By subject'}
          </button>
        ))}
      </div>

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
      ) : view === 'subjects' ? (
        <SubjectRollup events={mine} day={selected} />
      ) : mine.length === 0 ? (
        <div
          className="border border-border bg-card p-8 text-center"
          style={{ borderRadius: '16px', boxShadow: 'var(--shadow-card)' }}
        >
          <p className="text-warm-gray" style={{ fontSize: '15px' }}>
            {signedIn
              ? `Nothing scheduled for ${format(selected, 'MMM d')}.`
              : 'Connect Google Calendar to see your events.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {academicMine.map((event) => {
            const peers = coClimbingNames(event, classifiedEvents);
            return (
              <div
                key={event.id}
                className="border border-border bg-card p-5 sm:p-6"
                style={{ borderRadius: '16px', boxShadow: 'var(--shadow-card)' }}
              >
                <div className="mb-1 flex items-start justify-between gap-3">
                  <h3 className="text-ink" style={{ fontSize: '20px', fontWeight: 600 }}>
                    {event.title}
                  </h3>
                  {event.subject && (
                    <span className="shrink-0 rounded-full bg-moss/10 px-2 py-0.5 text-xs text-moss">
                      {event.subject}
                    </span>
                  )}
                </div>
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
                <button
                  type="button"
                  onClick={() => toggleAcademic(event)}
                  className="mt-2 w-full text-xs text-warm-gray hover:text-ink"
                >
                  Not a study session
                </button>
              </div>
            );
          })}

          {otherMine.length > 0 && (
            <details className="rounded-2xl border border-border bg-card/60 p-4">
              <summary className="cursor-pointer text-sm text-warm-gray">
                {otherMine.length} non-study event{otherMine.length === 1 ? '' : 's'} on this day
              </summary>
              <ul className="mt-3 space-y-2">
                {otherMine.map((event) => (
                  <li
                    key={event.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 border border-border bg-card px-3 py-2"
                    style={{ borderRadius: '10px' }}
                  >
                    <span className="text-ink" style={{ fontSize: '14px' }}>{event.title}</span>
                    <span className="text-warm-gray" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      {event.allDay ? 'All day' : formatRange(event)}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleAcademic(event)}
                      className="text-xs text-primary hover:underline"
                    >
                      Mark as study
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {others.length > 0 && (
            <div>
              <p className="mb-2 text-warm-gray" style={{ fontSize: '13px' }}>Friends on the mountain {isToday ? 'today' : 'this day'}</p>
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
