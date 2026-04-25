import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronRight, Bell, UserPen, HelpCircle, LogOut, ShieldCheck } from "lucide-react";
import { addDays, format, startOfDay, startOfWeek } from "date-fns";
import { ClimberAvatar } from "./ClimberAvatar";
import { getPrefs, getWeeklyCommitmentSummary, updatePrefs } from "../../lib/compcal-state";
import { eventsForDay, getCalendarFixture } from "../../data/calendarFixtures";

type RowProps = {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
};

function SettingsRow({ icon, label, hint, onClick }: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-foreground/5 active:bg-foreground/10"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground/8 text-terracotta">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block text-[15px] text-ink"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {label}
        </span>
        {hint ? (
          <span className="mt-0.5 block text-xs text-warm-gray">{hint}</span>
        ) : null}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-warm-gray" aria-hidden />
    </button>
  );
}

export function ProfileScreen() {
  const [prefs, setPrefs] = useState(() => getPrefs());
  const weekly = useMemo(() => getWeeklyCommitmentSummary(), []);
  const bars = weekly.points.length ? weekly.points : [18, 24, 28, 42, 36, 54, 65];
  const weekView = useMemo(() => {
    const today = startOfDay(new Date());
    const monday = startOfWeek(today, { weekStartsOn: 1 });
    const events = getCalendarFixture(today);
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(monday, i);
      const myBlocks = eventsForDay(day, events).filter((e) => e.ownerId === "me").length;
      return { day, myBlocks };
    });
  }, []);

  const toggleLowPressure = () => {
    const next = updatePrefs({ lowPressureMode: !prefs.lowPressureMode });
    setPrefs(next);
  };

  const toggleFocusChecks = () => {
    const next = updatePrefs({ focusChecksEnabled: !prefs.focusChecksEnabled });
    setPrefs(next);
  };

  return (
    <div className="px-6 pt-10 pb-6">
      <h1
        className="mb-6 text-ink"
        style={{ fontFamily: "var(--font-serif)", fontSize: "32px" }}
      >
        Profile
      </h1>

      <section className="mb-8 overflow-hidden rounded-2xl border border-border bg-card/90 p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-col items-center text-center sm:flex-row sm:text-left">
          <div className="mb-4 shrink-0 sm:mb-0 sm:mr-6">
            <ClimberAvatar name="You" size={72} variant="pixelCat" isActive />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-xl text-ink"
              style={{ fontFamily: "var(--font-pixel)", letterSpacing: "0.02em" }}
            >
              Mountain Cat
            </p>
            <p className="mt-1 text-sm text-warm-gray">@you · NYU CompCal</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span className="rounded-full border border-border bg-background-solid/60 px-3 py-1 text-xs text-ink">
                {weekly.keptCommitments}-session commitments kept
              </span>
              <span className="rounded-full border border-border bg-background-solid/60 px-3 py-1 text-xs text-ink">
                {Math.floor(weekly.totalFocusedMinutes / 60)}h {weekly.totalFocusedMinutes % 60}m this week
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-border bg-card/80 p-4">
        <p className="mb-2 text-[11px] uppercase tracking-wide text-warm-gray">
          Weekly kept commitments
        </p>
        <div className="mb-3 flex h-14 items-end gap-1.5">
          {bars.map((point, idx) => (
            <div
              key={idx}
              className="flex-1 rounded-t bg-moss/70"
              style={{ height: `${Math.max(12, Math.min(100, point))}%` }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-[12px] text-warm-gray">
          <span>{weekly.completedSessions} sessions completed</span>
          <span>{weekly.avgFocusScore}% avg focus</span>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-border bg-card/80 p-4">
        <p className="mb-2 text-[11px] uppercase tracking-wide text-warm-gray">Week view</p>
        <div className="grid grid-cols-7 gap-1.5">
          {weekView.map(({ day, myBlocks }) => (
            <div key={day.toISOString()} className="rounded-lg border border-border bg-background-solid/45 px-1 py-2 text-center">
              <p className="text-[10px] text-warm-gray">{format(day, "EEE")}</p>
              <p className="text-sm font-semibold text-ink">{format(day, "d")}</p>
              <p className="text-[10px] text-moss">
                {myBlocks} block{myBlocks === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-3">
        <p
          className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-warm-gray"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Account
        </p>
        <div className="overflow-hidden rounded-2xl border border-border bg-card/80">
          <SettingsRow
            icon={<UserPen className="h-4 w-4" strokeWidth={2} />}
            label="Edit profile"
            hint="Name, avatar, school"
          />
          <div className="mx-3 h-px bg-border" />
          <SettingsRow
            icon={<Bell className="h-4 w-4" strokeWidth={2} />}
            label="Notifications"
            hint="Focus checks, friend activity"
          />
          <div className="mx-3 h-px bg-border" />
          <button
            type="button"
            onClick={toggleLowPressure}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-foreground/5 active:bg-foreground/10"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground/8 text-terracotta">
              <HandHeldIcon />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] text-ink">Low-pressure mode</span>
              <span className="mt-0.5 block text-xs text-warm-gray">
                Softer nudges, roast disabled
              </span>
            </span>
            <span
              className={`rounded-full px-2 py-1 text-[11px] ${prefs.lowPressureMode ? "bg-moss/20 text-moss" : "bg-background-solid/70 text-warm-gray"}`}
            >
              {prefs.lowPressureMode ? "On" : "Off"}
            </span>
          </button>
        </div>
      </section>

      <section>
        <p
          className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-warm-gray"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          CompCal
        </p>
        <div className="overflow-hidden rounded-2xl border border-border bg-card/80">
          <SettingsRow
            icon={<HelpCircle className="h-4 w-4" strokeWidth={2} />}
            label="Help & feedback"
          />
          <div className="mx-3 h-px bg-border" />
          <button
            type="button"
            onClick={toggleFocusChecks}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-foreground/5 active:bg-foreground/10"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground/8 text-terracotta">
              <ShieldCheck className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] text-ink">Focus checks</span>
              <span className="mt-0.5 block text-xs text-warm-gray">
                Periodic snapshots only, never continuous video
              </span>
            </span>
            <span
              className={`rounded-full px-2 py-1 text-[11px] ${prefs.focusChecksEnabled ? "bg-moss/20 text-moss" : "bg-background-solid/70 text-warm-gray"}`}
            >
              {prefs.focusChecksEnabled ? "On" : "Off"}
            </span>
          </button>
          <div className="mx-3 h-px bg-border" />
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-coral/10 active:bg-coral/15"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-coral/15 text-coral">
              <LogOut className="h-4 w-4" strokeWidth={2} />
            </span>
            <span
              className="flex-1 text-[15px] text-coral"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Sign out
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-warm-gray" aria-hidden />
          </button>
        </div>
      </section>
    </div>
  );
}

function HandHeldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
      <path d="M12 22s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 12c0 5.65-7 10-7 10Z" strokeWidth="1.8" />
    </svg>
  );
}
