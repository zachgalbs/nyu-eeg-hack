import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { format, isSameDay, startOfDay } from "date-fns";
import { Mountain, ChevronRight, CalendarDays } from "lucide-react";
import { eventsForDay, type CalendarEvent } from "../../data/calendarFixtures";
import { fetchMyEventsThisWeek, AuthError } from "../../lib/googleCalendar";
import { isSignedIn } from "../../lib/auth";
import { SNOW_MOUNTAIN_RETRO_THEME_SRC } from "../../lib/theme-asset";

function durationMinutes(e: CalendarEvent) {
  return Math.max(1, Math.round((e.end.getTime() - e.start.getTime()) / 60000));
}

function formatTime(d: Date) {
  return format(d, "h:mm a");
}

export function MountainLandingScreen() {
  const navigate = useNavigate();
  const today = useMemo(() => startOfDay(new Date()), []);
  const signedIn = isSignedIn();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(signedIn);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    setLoading(true);
    setAuthError(false);
    fetchMyEventsThisWeek(today)
      .then((fetched) => {
        setEvents(fetched);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof AuthError) setAuthError(true);
        setLoading(false);
      });
  }, [signedIn, today]);

  const todayMine = useMemo(
    () => eventsForDay(today, events).filter((e) => e.ownerId === "me"),
    [today, events],
  );

  const now = useMemo(() => new Date(), []);
  const upcoming = useMemo(
    () => todayMine.filter((e) => e.end.getTime() > now.getTime()).sort((a, b) => a.start.getTime() - b.start.getTime()),
    [todayMine, now],
  );

  const heroEvent = upcoming[0] ?? todayMine[0] ?? null;
  const otherEvents = useMemo(
    () => (heroEvent ? todayMine.filter((e) => e.id !== heroEvent.id) : []),
    [todayMine, heroEvent],
  );

  const startEvent = (event: CalendarEvent) => {
    navigate(`/mountain/${event.id}`, {
      state: { title: event.title, duration: durationMinutes(event), playMeetUp: true },
    });
  };

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-background-solid">
      <img
        src={SNOW_MOUNTAIN_RETRO_THEME_SRC}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-100"
        decoding="async"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background-solid/30 via-background-solid/55 to-background-solid/85"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-4 pb-32 pt-10 sm:pt-16">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-[11px] uppercase tracking-wide text-warm-gray backdrop-blur-md" style={{ fontFamily: "var(--font-pixel)" }}>
            <Mountain className="h-3.5 w-3.5" strokeWidth={2} />
            Today's climbs
          </div>
          <h1
            className="text-foreground"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(1.8rem, 5vw, 2.4rem)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
            }}
          >
            Pick a block to start climbing.
          </h1>
          <p className="text-sm text-warm-gray">
            Every focus session you commit to plants you on the mountain.
          </p>
        </div>

        {!signedIn ? (
          <div className="w-full rounded-2xl border border-border bg-card/95 p-6 text-center shadow-[var(--shadow-card)] backdrop-blur-md">
            <p className="mb-3 text-foreground">Sign in to see your calendar blocks.</p>
            <button
              type="button"
              onClick={() => navigate("/welcome")}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Sign in
            </button>
          </div>
        ) : authError ? (
          <div className="w-full rounded-2xl border border-border bg-card/95 p-6 text-center shadow-[var(--shadow-card)] backdrop-blur-md">
            <p className="mb-3 text-foreground">Calendar access expired.</p>
            <button
              type="button"
              onClick={() => navigate("/welcome")}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Reconnect
            </button>
          </div>
        ) : loading ? (
          <div className="w-full rounded-2xl border border-border bg-card/85 p-8 text-center text-warm-gray shadow-[var(--shadow-card)] backdrop-blur-md">
            Loading today's events...
          </div>
        ) : heroEvent ? (
          <>
            <button
              type="button"
              onClick={() => startEvent(heroEvent)}
              className="group w-full rounded-2xl border border-border bg-card/95 p-5 text-left shadow-[var(--shadow-card)] backdrop-blur-md transition-transform hover:scale-[1.01] active:scale-[0.99] sm:p-6"
            >
              <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-moss" style={{ fontFamily: "var(--font-pixel)" }}>
                {isSameDay(heroEvent.start, today) && heroEvent.start.getTime() > now.getTime() ? "Up next" : "Ready when you are"}
              </div>
              <h2
                className="mb-1 text-foreground"
                style={{ fontFamily: "var(--font-serif)", fontSize: "22px", fontWeight: 500 }}
              >
                {heroEvent.title}
              </h2>
              <p className="mb-4 text-xs text-warm-gray" style={{ fontFamily: "var(--font-mono)" }}>
                {formatTime(heroEvent.start)} · {durationMinutes(heroEvent)}m
              </p>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                  Start climbing
                </span>
                <ChevronRight className="h-5 w-5 text-warm-gray transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>

            {otherEvents.length > 0 && (
              <div className="mt-5 w-full">
                <p className="mb-2 px-1 text-[11px] uppercase tracking-wide text-warm-gray" style={{ fontFamily: "var(--font-pixel)" }}>
                  Other blocks today
                </p>
                <ul className="space-y-2">
                  {otherEvents.map((event) => (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => startEvent(event)}
                        className="flex w-full items-center gap-3 rounded-xl border border-border bg-card/85 px-4 py-3 text-left shadow-[var(--shadow-card)] backdrop-blur-md transition-opacity hover:opacity-90"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground" style={{ fontFamily: "var(--font-serif)" }}>
                            {event.title}
                          </p>
                          <p className="text-[11px] text-warm-gray" style={{ fontFamily: "var(--font-mono)" }}>
                            {formatTime(event.start)} · {durationMinutes(event)}m
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-warm-gray" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="w-full rounded-2xl border border-border bg-card/95 p-6 text-center shadow-[var(--shadow-card)] backdrop-blur-md">
            <p className="mb-1 text-foreground" style={{ fontFamily: "var(--font-serif)" }}>
              No focus blocks on your calendar today.
            </p>
            <p className="mb-4 text-sm text-warm-gray">
              Add one in Calendar to start climbing.
            </p>
            <button
              type="button"
              onClick={() => navigate("/calendar")}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <CalendarDays className="h-4 w-4" />
              Open Calendar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
