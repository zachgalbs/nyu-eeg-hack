import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, Bell, UserPen, HelpCircle, LogOut, ShieldCheck, Flame } from "lucide-react";
import { addDays, format, startOfDay, startOfWeek } from "date-fns";
import { ClimberAvatar } from "./ClimberAvatar";
import { getPrefs, getWeeklyCommitmentSummary, updatePrefs } from "../../lib/compcal-state";
import { eventsForDay } from "../../data/calendarFixtures";

const PROFILE_NAME_KEY = "compcal_profile_name";

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
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState(() => getPrefs());
  const [profileName, setProfileName] = useState(() => {
    try {
      return localStorage.getItem(PROFILE_NAME_KEY) || "Mountain Cat";
    } catch {
      return "Mountain Cat";
    }
  });
  const weekly = useMemo(() => getWeeklyCommitmentSummary(), []);
  const [allowRoasts, setAllowRoasts] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/profile/preferences', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.allowRoasts === 'boolean') {
          setAllowRoasts(data.allowRoasts);
        }
      })
      .catch(() => {});
  }, []);

  const toggleAllowRoasts = async () => {
    if (allowRoasts === null) return;
    const next = !allowRoasts;
    setAllowRoasts(next);
    try {
      await fetch('/api/profile/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ allowRoasts: next }),
      });
    } catch {
      setAllowRoasts(!next);
    }
  };
  const bars = weekly.points.length ? weekly.points : [18, 24, 28, 42, 36, 54, 65];
  const weekView = useMemo(() => {
    const today = startOfDay(new Date());
    const monday = startOfWeek(today, { weekStartsOn: 1 });
    const events: import("../../data/calendarFixtures").CalendarEvent[] = [];
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

  const editProfile = () => {
    const next = window.prompt("Update profile name", profileName)?.trim();
    if (!next) return;
    setProfileName(next);
    try {
      localStorage.setItem(PROFILE_NAME_KEY, next);
    } catch {
      /* ignore storage failures */
    }
  };

  const manageNotifications = () => {
    const nextEnabled = !prefs.focusChecksEnabled;
    const confirmed = window.confirm(
      `${nextEnabled ? "Enable" : "Disable"} focus-check notifications?`
    );
    if (!confirmed) return;
    const next = updatePrefs({ focusChecksEnabled: nextEnabled });
    setPrefs(next);
  };

  const openHelpFeedback = () => {
    window.open("https://github.com/candpixie/nyu-eeg-hack-1/issues/new", "_blank", "noopener");
  };

  const openPrivacyPolicy = () => {
    navigate("/privacy");
  };

  const signOut = async () => {
    const confirmed = window.confirm("Sign out of CompCal on this device?");
    if (!confirmed) return;
    // Tell the server to delete the auth_sessions row and clear cookies.
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      /* network failure — still clear local state */
    }
    try {
      const keysToClear: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("compcal_")) keysToClear.push(key);
      }
      keysToClear.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore storage failures */
    }
    navigate("/welcome", { replace: true });
  };

  return (
    <div className="px-6 pt-10 pb-28 sm:pb-32">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1
          className="text-ink"
          style={{ fontFamily: "var(--font-serif)", fontSize: "32px" }}
        >
          Profile
        </h1>
        <button
          type="button"
          onClick={() => navigate("/calendar")}
          className="rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-semibold text-foreground transition-opacity hover:opacity-85"
        >
          Back to calendar
        </button>
      </div>

      <section className="mb-8 overflow-hidden rounded-2xl border border-border bg-card/90 p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-col items-center text-center sm:flex-row sm:text-left">
          <div className="mb-4 shrink-0 sm:mb-0 sm:mr-6">
            <ClimberAvatar name={profileName} size={72} variant="pixelCat" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-xl text-ink"
              style={{ fontFamily: "var(--font-pixel)", letterSpacing: "0.02em" }}
            >
              {profileName}
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
            onClick={editProfile}
          />
          <div className="mx-3 h-px bg-border" />
          <SettingsRow
            icon={<Bell className="h-4 w-4" strokeWidth={2} />}
            label="Notifications"
            hint="Focus checks, friend activity"
            onClick={manageNotifications}
          />
          <div className="mx-3 h-px bg-border" />
          <SettingsRow
            icon={<ShieldCheck className="h-4 w-4" strokeWidth={2} />}
            label="Privacy policy"
            hint="How we handle account, calendar, and webcam data"
            onClick={openPrivacyPolicy}
          />
          <div className="mx-3 h-px bg-border" />
          <button
            type="button"
            onClick={toggleAllowRoasts}
            disabled={allowRoasts === null}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-foreground/5 active:bg-foreground/10 disabled:opacity-60"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground/8 text-terracotta">
              <Flame className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] text-ink">Allow roasts from friends</span>
              <span className="mt-0.5 block text-xs text-warm-gray">
                When off, friends can't roast you. You can still roast them.
              </span>
            </span>
            <span
              className={`rounded-full px-2 py-1 text-[11px] ${
                allowRoasts === null
                  ? 'bg-background-solid/70 text-warm-gray'
                  : allowRoasts
                  ? 'bg-moss/20 text-moss'
                  : 'bg-coral/15 text-coral'
              }`}
            >
              {allowRoasts === null ? '…' : allowRoasts ? 'On' : 'Off'}
            </span>
          </button>
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
            hint="Open issue tracker"
            onClick={openHelpFeedback}
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
            onClick={signOut}
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
