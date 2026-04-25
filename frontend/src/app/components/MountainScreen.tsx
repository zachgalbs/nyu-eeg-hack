import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Pause,
  Play,
  ShieldCheck,
  HandHeart,
  Flag,
  Timer,
  Trophy,
} from "lucide-react";
import { MountainSVG } from "./MountainSVG";
import { FocusCheckToast } from "./FocusCheckToast";
import { RoastModal } from "./RoastModal";
import { StudyAssistantPanel } from "./StudyAssistantPanel";
import { SNOW_MOUNTAIN_RETRO_THEME_SRC } from "../../lib/theme-asset";
import {
  getBuddyCommitment,
  getPrefs,
  saveSessionOutcome,
  updatePrefs,
} from "../../lib/compcal-state";

const eventData: Record<string, { name: string; duration: number }> = {
  '1': { name: "Deep Work: Design System", duration: 120 },
  '2': { name: "Team Standup", duration: 30 },
  '3': { name: "Focus Block: Code Review", duration: 120 },
  'me-1': { name: "Deep Work: Design System", duration: 120 },
  'me-2': { name: "Team Standup", duration: 30 },
  'me-3': { name: "Focus Block: Code Review", duration: 120 },
  'me-4': { name: "Reading", duration: 90 },
  active: { name: "Focus Session", duration: 60 },
};

function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function MountainScreen() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const eventKey = eventId ?? "active";
  const event = eventData[eventKey] ?? eventData.active;

  const totalSeconds = Math.min(Math.max(45, event.duration * 60), 180);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [checkedInAt, setCheckedInAt] = useState<Date | null>(null);
  const [progress, setProgress] = useState(0);
  const [focusScore, setFocusScore] = useState(97);
  const [lastCheck, setLastCheck] = useState<'verified' | 'distracted'>('verified');
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState<'verified' | 'distracted'>('verified');
  const [distractedCount, setDistractionCount] = useState(0);
  const [distractedChecksTotal, setDistractedChecksTotal] = useState(0);
  const [showRoast, setShowRoast] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [prefs, setPrefs] = useState(() => getPrefs());
  const [buddyCommitment] = useState(() => getBuddyCommitment(eventKey));
  const summitSent = useRef(false);
  const [artReady, setArtReady] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (isPaused || !hasCheckedIn) return;
    const id = window.setInterval(() => {
      setElapsedSeconds((prev) => (prev >= totalSeconds ? prev : prev + 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [totalSeconds, isPaused, hasCheckedIn]);

  useEffect(() => {
    setProgress(Math.min(100, (elapsedSeconds / totalSeconds) * 100));
  }, [elapsedSeconds, totalSeconds]);

  useEffect(() => {
    if (
      elapsedSeconds >= totalSeconds &&
      totalSeconds > 0 &&
      hasCheckedIn &&
      !summitSent.current
    ) {
      summitSent.current = true;
      const completedMinutes = Math.max(
        1,
        Math.round((elapsedSeconds / Math.max(1, totalSeconds)) * event.duration)
      );
      const keptCommitment =
        completedMinutes >= Math.round(event.duration * 0.8) && focusScore >= 80;
      saveSessionOutcome({
        id: `${eventKey}-${Date.now()}`,
        eventId: eventKey,
        eventTitle: event.name,
        plannedMinutes: event.duration,
        completedMinutes,
        focusScore,
        distractedChecks: distractedChecksTotal,
        keptCommitment,
        buddyId: buddyCommitment?.buddyId,
        buddyName: buddyCommitment?.buddyName,
        completedAt: new Date().toISOString(),
      });
      navigate(`/summit/${eventId ?? "me-1"}`);
    }
  }, [
    elapsedSeconds,
    totalSeconds,
    hasCheckedIn,
    eventId,
    event.duration,
    event.name,
    eventKey,
    navigate,
    focusScore,
    distractedChecksTotal,
    buddyCommitment?.buddyId,
    buddyCommitment?.buddyName,
  ]);

  useEffect(() => {
    if (isPaused || !hasCheckedIn || !prefs.focusChecksEnabled) return;
    const focusCheckInterval = window.setInterval(() => {
      const isDistracted = Math.random() < 0.15;
      const checkResult = isDistracted ? 'distracted' : 'verified';

      setLastCheck(checkResult);
      setToastType(checkResult);
      setShowToast(true);

      if (isDistracted) {
        setDistractedChecksTotal((prev) => prev + 1);
        setFocusScore((prev) => Math.max(70, prev - (prefs.lowPressureMode ? 1 : 3)));
        setDistractionCount((prev) => {
          const newCount = prev + 1;
          if (!prefs.lowPressureMode && newCount >= 3) {
            setShowRoast(true);
            return 0;
          }
          return newCount;
        });
      } else {
        setFocusScore((prev) => Math.min(100, prev + 1));
      }

      window.setTimeout(() => setShowToast(false), 2500);
    }, 10000);

    return () => window.clearInterval(focusCheckInterval);
  }, [isPaused, hasCheckedIn, prefs.focusChecksEnabled, prefs.lowPressureMode]);

  const toggleFocusChecks = () => {
    const next = updatePrefs({ focusChecksEnabled: !prefs.focusChecksEnabled });
    setPrefs(next);
  };

  const blockMinutes = Math.floor(elapsedSeconds / 60);
  const blockLabel =
    blockMinutes >= 60
      ? `${Math.floor(blockMinutes / 60)}h ${blockMinutes % 60}m this block`
      : `${blockMinutes}m this block`;
  const timeline = [
    {
      id: "checkin",
      label: "Check in",
      Icon: Flag,
      state: hasCheckedIn ? "done" : "current",
    },
    {
      id: "focus",
      label: "Focus climb",
      Icon: Timer,
      state: hasCheckedIn ? (progress >= 98 ? "done" : "current") : "upcoming",
    },
    {
      id: "summit",
      label: "Summit",
      Icon: Trophy,
      state: progress >= 98 ? "done" : "upcoming",
    },
  ] as const;

  return (
    <>
      <div className="fixed inset-0 z-30 overflow-hidden bg-background-solid">
        <img
          src={SNOW_MOUNTAIN_RETRO_THEME_SRC}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            artReady ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setArtReady(true)}
          decoding="async"
        />

        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background-solid/25 via-background-solid/40 to-background-solid/70"
          aria-hidden
        />

        <div
          className={`absolute inset-0 transition-opacity duration-500 ${
            artReady ? "opacity-100" : "opacity-0"
          }`}
        >
          <MountainSVG
            progress={progress}
            climberName="You"
            climberColor="#c4b5e8"
            trailOnly
            isPaused={!hasCheckedIn || isPaused}
          />
        </div>

        <div className="absolute top-0 left-0 right-0 z-10 flex justify-center px-4 pt-4 sm:px-6">
          <div className="flex w-full max-w-6xl items-start justify-between gap-3">
            <div
              className={`min-w-0 flex-1 rounded-2xl border border-border bg-card px-4 py-4 shadow-[var(--shadow-card)] backdrop-blur-md sm:px-5 sm:py-4 ${isPaused ? "opacity-90" : ""}`}
            >
              {isPaused ? (
                <div
                  className="mb-2 inline-block rounded-full border border-border bg-background-solid/80 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-warm-gray"
                  style={{ fontFamily: "var(--font-pixel)" }}
                >
                  Paused
                </div>
              ) : null}
              <div
                className={`mb-1 text-foreground tabular-nums tracking-tight ${isPaused ? "text-warm-gray" : ""}`}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "clamp(2rem, 6vw, 2.75rem)",
                  fontWeight: 600,
                  lineHeight: 1.05,
                }}
              >
                {formatHMS(elapsedSeconds)}
              </div>
              <h2
                className="mb-3 truncate text-foreground"
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "20px",
                  fontWeight: 400,
                }}
              >
                {event.name}
              </h2>
              <div
                className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2 text-muted"
                style={{
                  fontSize: "13px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <span>Today&apos;s focus (demo): 3h 24m</span>
                <span className="text-foreground/90">
                  {hasCheckedIn ? blockLabel : "check in to start timer"}
                </span>
              </div>
              {!hasCheckedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    setHasCheckedIn(true);
                    setCheckedInAt(new Date());
                  }}
                  className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Check in now
                </button>
              ) : checkedInAt ? (
                <p className="mt-2 text-xs text-warm-gray">
                  Checked in at{" "}
                  {checkedInAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
              ) : null}
              {isPaused ? (
                <p className="mt-2 text-xs text-warm-gray">
                  Pausing is part of focus. Breathe, reset, and resume when ready.
                </p>
              ) : null}
              {!isPaused && lastCheck === "distracted" ? (
                <p className="mt-2 text-xs text-warm-gray">
                  Drift happens. Pick one tiny next step and restart.
                </p>
              ) : null}
              {buddyCommitment ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-moss">
                  <HandHeart className="h-3.5 w-3.5" />
                  Buddy check-in active with {buddyCommitment.buddyName}.
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                type="button"
                onClick={() => setIsPaused((p) => !p)}
                className="flex items-center justify-center rounded-full border border-border bg-card px-3 py-2 text-foreground transition-opacity hover:opacity-80"
                aria-label={isPaused ? "Resume session" : "Pause session"}
                aria-pressed={isPaused}
                disabled={!hasCheckedIn}
              >
                {isPaused ? (
                  <Play className="h-5 w-5" strokeWidth={2} />
                ) : (
                  <Pause className="h-5 w-5" strokeWidth={2} />
                )}
              </button>
              <button
                type="button"
                onClick={() => setAssistantOpen(true)}
                className="rounded-full border border-border bg-card px-3 py-2 text-foreground transition-opacity hover:opacity-90"
                style={{ fontSize: "13px", fontWeight: 600 }}
              >
                Ask
              </button>
            </div>
          </div>
        </div>

        <div className="absolute bottom-24 left-4 right-4 z-10 mx-auto max-w-6xl rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] backdrop-blur-md sm:left-6 sm:right-6">
          <div className="flex items-center gap-4">
            <div
              className="flex shrink-0 items-center justify-center rounded-lg bg-mountain/50 text-[10px] text-foreground"
              style={{ width: 80, height: 60 }}
            >
              <div className="text-center">
                <div
                  className={`mx-auto mb-1 h-2 w-2 rounded-full bg-primary ${isPaused ? "" : "animate-pulse"}`}
                />
                {prefs.focusChecksEnabled ? (isPaused ? "PAUSED" : "LIVE") : "CHECKS OFF"}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div
                className="mb-1 text-foreground tabular-nums"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "24px",
                  fontWeight: 600,
                }}
              >
                {focusScore}% focused
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    lastCheck === "verified" ? "bg-moss" : "bg-coral"
                  }`}
                />
                <span className="text-muted" style={{ fontSize: "13px" }}>
                  {lastCheck === "verified" ? "focused" : "distracted"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-44 left-4 right-4 z-10 mx-auto max-w-6xl rounded-2xl border border-border bg-card/90 px-4 py-3 backdrop-blur-md sm:left-6 sm:right-6">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-warm-gray">Timeline</p>
          <div className="grid grid-cols-3 gap-2">
            {timeline.map(({ id, label, Icon, state }) => (
              <div
                key={id}
                className={`rounded-xl border px-2 py-2 text-center ${
                  state === "done"
                    ? "border-moss/60 bg-moss/15"
                    : state === "current"
                      ? "border-terracotta/60 bg-terracotta/10"
                      : "border-border bg-background-solid/40"
                }`}
              >
                <Icon
                  className={`mx-auto mb-1 h-4 w-4 ${
                    state === "done"
                      ? "text-moss"
                      : state === "current"
                        ? "text-terracotta"
                        : "text-warm-gray"
                  }`}
                />
                <p className="text-[11px] text-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-2 left-4 right-4 z-10 mx-auto max-w-6xl rounded-xl border border-border bg-card/95 px-3 py-2 text-xs text-warm-gray backdrop-blur-md sm:left-6 sm:right-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-foreground/90">
              <ShieldCheck className="h-3.5 w-3.5" />
              Focus checks are periodic snapshots only (no continuous recording).
            </span>
            <button
              type="button"
              onClick={toggleFocusChecks}
              className="rounded-full border border-border bg-background-solid/70 px-3 py-1 text-[11px] text-foreground transition-opacity hover:opacity-80"
            >
              {prefs.focusChecksEnabled ? "Turn checks off" : "Turn checks on"}
            </button>
          </div>
        </div>

        {showToast && (
          <FocusCheckToast type={toastType} lowPressureMode={prefs.lowPressureMode} />
        )}
      </div>

      {assistantOpen && (
        <StudyAssistantPanel onClose={() => setAssistantOpen(false)} />
      )}

      {showRoast && <RoastModal onClose={() => setShowRoast(false)} />}
    </>
  );
}
