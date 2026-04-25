import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Pause,
  Play,
  HandHeart,
  LogOut,
  Users,
  X,
  Flag,
  Timer,
  Trophy,
} from "lucide-react";
import { MountainSVG } from "./MountainSVG";
import { ClimberAvatar } from "./ClimberAvatar";
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
import { getSortedFriendPresence } from "../../lib/friends-presence";
import {
  getTabIdentity,
  publishRoast,
  subscribeRoasts,
  type RoastDelivery,
} from "../../lib/roast-channel";
import {
  generateRoast,
  getUserIdFromCookie,
  persistThrowEvent,
  pollRoastInbox,
} from "../../lib/roast-api";

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

type ActiveRoast = {
  text: string;
  trigger: "auto" | "friend_throw";
  fromName?: string;
};

function estimateFriendFocus(seedMinutes: number) {
  return 72 + (seedMinutes % 24);
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
  const [activeRoast, setActiveRoast] = useState<ActiveRoast | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [friendsPanelOpen, setFriendsPanelOpen] = useState(false);
  const [prefs, setPrefs] = useState(() => getPrefs());
  const [buddyCommitment] = useState(() => getBuddyCommitment(eventKey));
  const summitSent = useRef(false);
  const [artReady, setArtReady] = useState(false);
  const [timelineFlash, setTimelineFlash] = useState<"checkin" | "focus" | "summit" | null>(null);
  const [throwTargetId, setThrowTargetId] = useState<string | null>(null);
  const [isThrowing, setIsThrowing] = useState(false);
  const [projectile, setProjectile] = useState<{ fromProgress: number; toProgress: number; active: boolean } | null>(null);
  const localUserId = useMemo(() => getUserIdFromCookie() || getTabIdentity(), []);

  // Background video state
  type BgMode = 'static' | 'climbing' | 'going_to_break' | 'going_from_break';
  const [bgMode, setBgMode] = useState<BgMode>('static');
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const prevIsPausedRef = useRef(false);

  // Switch to climbing background on check-in
  useEffect(() => {
    if (hasCheckedIn) setBgMode('climbing');
  }, [hasCheckedIn]);

  // Detect pause/resume transitions and play the appropriate video
  useEffect(() => {
    const prev = prevIsPausedRef.current;
    prevIsPausedRef.current = isPaused;
    if (!hasCheckedIn) return;
    if (!prev && isPaused) setBgMode('going_to_break');
    else if (prev && !isPaused) setBgMode('going_from_break');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused]);

  // Imperatively load and play the correct video when bgMode changes
  useEffect(() => {
    const v = bgVideoRef.current;
    if (!v || bgMode === 'static') return;
    const srcs = {
      climbing: '/media/climbing_animation.mp4',
      going_to_break: '/media/going_to_break.mov',
      going_from_break: '/media/going_from_break.mov',
    } as const;
    v.src = srcs[bgMode as keyof typeof srcs];
    v.loop = bgMode === 'climbing';
    v.load();
    v.play().catch(() => {});
  }, [bgMode]);
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
            void (async () => {
              const roastText = await generateRoast({
                userName: "You",
                userBlock: event.name,
                minutesIn: Math.floor(elapsedSeconds / 60),
                trigger: "auto",
              });
              setActiveRoast({ text: roastText, trigger: "auto" });
            })();
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
  }, [isPaused, hasCheckedIn, prefs.focusChecksEnabled, prefs.lowPressureMode, elapsedSeconds, event.name]);

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
  const friendPresence = useMemo(
    () => getSortedFriendPresence().filter((friend) => !friend.isUser),
    []
  );
  const activeFriends = friendPresence.filter((friend) => friend.status === "climbing");
  const friendFocusMap = useMemo(
    () =>
      Object.fromEntries(
        activeFriends.map((friend) => [String(friend.id), estimateFriendFocus(friend.focusedTimeToday)])
      ),
    [activeFriends]
  );
  const friendClimbers = useMemo(
    () =>
      activeFriends.slice(0, 4).map((friend, index) => {
        const friendFocus = friendFocusMap[String(friend.id)] ?? 78;
        const relativeDelta = (friendFocus - focusScore) * 0.85;
        return {
          id: String(friend.id),
          name: friend.name,
          progress: Math.max(4, Math.min(99, progress + relativeDelta)),
          color: index % 2 === 0 ? "#91b8d8" : "#87d8b0",
        };
      }),
    [activeFriends, friendFocusMap, focusScore, progress]
  );
  const throwTarget = useMemo(
    () => activeFriends.find((friend) => String(friend.id) === throwTargetId) || activeFriends[0] || null,
    [activeFriends, throwTargetId]
  );
  const stripFriends = activeFriends.slice(0, 4);
  const overflowActiveCount = Math.max(0, activeFriends.length - stripFriends.length);
  const throwTargetFocus = throwTarget ? friendFocusMap[String(throwTarget.id)] ?? 75 : null;
  const canThrow =
    hasCheckedIn &&
    !isPaused &&
    !!throwTarget &&
    throwTargetFocus !== null &&
    focusScore >= throwTargetFocus + 5 &&
    !isThrowing;
  const canExit = hasCheckedIn && elapsedSeconds > 0;

  useEffect(() => {
    if (activeFriends.length === 0) {
      setThrowTargetId(null);
      return;
    }
    setThrowTargetId((prev) => prev || String(activeFriends[0].id));
  }, [activeFriends]);

  const exitSession = () => {
    if (!canExit) {
      navigate("/calendar");
      return;
    }
    const confirmed = window.confirm(
      "Exit this session now? Your in-progress climb will be saved as a partial session."
    );
    if (!confirmed) return;

    const completedMinutes = Math.max(
      1,
      Math.round((elapsedSeconds / Math.max(1, totalSeconds)) * event.duration)
    );
    saveSessionOutcome({
      id: `${eventKey}-partial-${Date.now()}`,
      eventId: eventKey,
      eventTitle: event.name,
      plannedMinutes: event.duration,
      completedMinutes,
      focusScore,
      distractedChecks: distractedChecksTotal,
      keptCommitment: false,
      buddyId: buddyCommitment?.buddyId,
      buddyName: buddyCommitment?.buddyName,
      completedAt: new Date().toISOString(),
    });
    navigate("/calendar");
  };

  const handleTimelineAction = (stepId: "checkin" | "focus" | "summit") => {
    setTimelineFlash(stepId);
    window.setTimeout(() => setTimelineFlash(null), 650);

    if (stepId === "checkin") {
      if (!hasCheckedIn) {
        setHasCheckedIn(true);
        setCheckedInAt(new Date());
      }
      return;
    }

    if (stepId === "focus") {
      if (hasCheckedIn && isPaused) setIsPaused(false);
      return;
    }

    if (stepId === "summit" && hasCheckedIn && progress >= 98) {
      navigate(`/summit/${eventId ?? "me-1"}`);
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeRoasts((payload) => {
      if (payload.toUserId !== localUserId && payload.toUserId !== "broadcast") return;
      if (payload.fromUserId === localUserId) return;
      setActiveRoast({
        text: payload.roastText,
        trigger: payload.trigger,
        fromName: payload.fromName,
      });
    });
    return unsubscribe;
  }, [localUserId]);

  useEffect(() => {
    if (!hasCheckedIn) return;
    const id = window.setInterval(() => {
      void (async () => {
        const inboxEvents = await pollRoastInbox();
        const incoming = inboxEvents.find((event) => event.toUserId === localUserId);
        if (!incoming) return;
        setActiveRoast({
          text: incoming.roastText,
          trigger: incoming.trigger,
          fromName: incoming.fromName,
        });
      })();
    }, 2500);
    return () => window.clearInterval(id);
  }, [hasCheckedIn, localUserId]);

  const throwAtFriend = async () => {
    if (!throwTarget || !canThrow) return;
    setIsThrowing(true);
    const targetProgress = friendClimbers.find((friend) => friend.id === String(throwTarget.id))?.progress ?? progress;
    setProjectile({ fromProgress: progress, toProgress: targetProgress, active: true });
    window.setTimeout(() => setProjectile(null), 700);

    try {
      const roastText = await generateRoast({
        userName: "You",
        userBlock: event.name,
        friendName: throwTarget.name,
        friendActivity: throwTarget.currentTask || "studying",
        minutesIn: Math.floor(elapsedSeconds / 60),
        trigger: "friend_throw",
      });

      const payload: RoastDelivery = {
        id: `throw-${Date.now()}`,
        fromUserId: localUserId,
        fromName: "You",
        toUserId: "broadcast",
        toName: throwTarget.name,
        sessionId: eventKey,
        roastText,
        trigger: "friend_throw",
        createdAt: new Date().toISOString(),
      };

      publishRoast(payload);
      void persistThrowEvent({
        toUserId: String(throwTarget.id),
        toName: throwTarget.name,
        fromName: payload.fromName,
        roastText: payload.roastText,
        trigger: payload.trigger,
        sessionId: payload.sessionId,
      });
    } finally {
      setIsThrowing(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-30 overflow-y-auto bg-background-solid">
        <img
          src={SNOW_MOUNTAIN_RETRO_THEME_SRC}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            artReady && bgMode === 'static' ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setArtReady(true)}
          decoding="async"
        />

        {/* Video background: climbing loop + pause/resume transitions */}
        <video
          ref={bgVideoRef}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            bgMode !== 'static' ? "opacity-100" : "opacity-0"
          }`}
          muted
          playsInline
          onLoadedData={() => { if (!artReady) setArtReady(true); }}
          onEnded={() => {
            if (bgMode === 'going_to_break') setBgMode('static');
            if (bgMode === 'going_from_break') setBgMode('climbing');
          }}
        />

        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background-solid/25 via-background-solid/40 to-background-solid/70"
          aria-hidden
        />

        <div className="relative z-10 min-h-full px-4 pb-20 pt-4 sm:px-6 sm:pt-5">
          <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
            <div
              className={`min-w-0 flex-1 rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur-md sm:px-5 sm:py-3 ${isPaused ? "opacity-90" : ""}`}
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
                  fontSize: "clamp(1.75rem, 5.2vw, 2.35rem)",
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
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFriendsPanelOpen(true)}
                  className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-background-solid/55 px-2.5 py-1 text-[11px] text-foreground transition-opacity hover:opacity-85"
                >
                  <span className="inline-flex -space-x-1">
                    {stripFriends.map((friend) => (
                      <span
                        key={friend.id}
                        className="flex h-5 w-5 items-center justify-center rounded-full border border-card bg-card text-[9px] font-semibold text-ink"
                      >
                        {friend.name.charAt(0)}
                      </span>
                    ))}
                  </span>
                  <span>
                    {activeFriends.length > 0
                      ? `${activeFriends.length} climbing`
                      : "No active climbers"}
                  </span>
                  {overflowActiveCount > 0 ? <span>+{overflowActiveCount}</span> : null}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/friends")}
                  className="rounded-full border border-border bg-background-solid/55 px-2.5 py-1 text-[11px] text-foreground transition-opacity hover:opacity-85"
                >
                  Full list
                </button>
                {activeFriends.length > 0 ? (
                  <select
                    value={throwTarget ? String(throwTarget.id) : ""}
                    onChange={(event) => setThrowTargetId(event.target.value)}
                    className="rounded-full border border-border bg-background-solid/55 px-2 py-1 text-[11px] text-foreground"
                  >
                    {activeFriends.map((friend) => (
                      <option key={friend.id} value={String(friend.id)}>
                        {friend.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  type="button"
                  onClick={throwAtFriend}
                  disabled={!canThrow}
                  className="rounded-full border border-border bg-terracotta/20 px-2.5 py-1 text-[11px] text-foreground transition-opacity hover:opacity-85 disabled:opacity-45"
                >
                  {isThrowing ? "Throwing..." : throwTarget ? `Throw at ${throwTarget.name}` : "Throw"}
                </button>
              </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setFriendsPanelOpen(true)}
                  className="flex items-center justify-center gap-1 rounded-full border border-border bg-card px-3 py-2 text-foreground transition-opacity hover:opacity-80"
                  aria-label="Open friends panel"
                  style={{ fontSize: "12px", fontWeight: 600 }}
                >
                  <Users className="h-4 w-4" strokeWidth={2} />
                  Friends
                </button>
                <button
                  type="button"
                  onClick={exitSession}
                  className="flex items-center justify-center gap-1 rounded-full border border-border bg-card px-3 py-2 text-foreground transition-opacity hover:opacity-80"
                  aria-label="Exit session"
                  style={{ fontSize: "12px", fontWeight: 600 }}
                >
                  <LogOut className="h-4 w-4" strokeWidth={2} />
                  Exit
                </button>
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
          <div className={`flex items-center justify-center py-2 transition-opacity duration-500 ${
            artReady ? "opacity-100" : "opacity-0"
          }`}>
            <div
              className="overflow-hidden rounded-2xl border-2 border-border/40"
              style={{
                width: "min(88vw, 560px)",
                height: "min(42vh, 390px)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}
            >
              <MountainSVG
                progress={progress}
                climberName="You"
                climberColor="#c4b5e8"
                trailOnly
                isPaused={!hasCheckedIn || isPaused}
                friendClimbers={friendClimbers}
                throwProjectile={projectile}
              />
            </div>
          </div>

          <div className="w-full">
            <div className="flex items-end gap-3">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="rounded-2xl border border-border bg-card/90 px-4 py-3 backdrop-blur-md">
                  <p className="mb-2 text-[11px] uppercase tracking-wide text-warm-gray">Timeline</p>
                  <div className="grid grid-cols-3 gap-2">
                    {timeline.map(({ id, label, Icon, state }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleTimelineAction(id)}
                        disabled={id === "summit" && !(hasCheckedIn && progress >= 98)}
                        aria-disabled={id === "summit" && !(hasCheckedIn && progress >= 98)}
                        className={`rounded-xl border px-2 py-2 text-center ${
                          state === "done"
                            ? "border-moss/60 bg-moss/15"
                            : state === "current"
                              ? "border-terracotta/60 bg-terracotta/10"
                              : "border-border bg-background-solid/40"
                        } ${timelineFlash === id ? "ring-2 ring-primary/70" : ""} transition-opacity hover:opacity-90 disabled:opacity-55`}
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
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] backdrop-blur-md">
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
                      {throwTarget && throwTargetFocus !== null ? (
                        <p className="mt-1 text-[11px] text-warm-gray">
                          Throw unlocks when you are 5+ focus points ahead of {throwTarget.name} ({throwTargetFocus}%).
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card/95 px-3 py-2 text-xs text-warm-gray backdrop-blur-md">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={toggleFocusChecks}
                      className="rounded-full border border-border bg-background-solid/70 px-3 py-1 text-[11px] text-foreground transition-opacity hover:opacity-80"
                    >
                      {prefs.focusChecksEnabled ? "Turn checks off" : "Turn checks on"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {friendsPanelOpen && (
          <div className="absolute inset-0 z-30 flex items-end">
            <button
              type="button"
              onClick={() => setFriendsPanelOpen(false)}
              className="absolute inset-0 bg-ink/30"
              aria-label="Close friends panel"
            />
            <div className="relative z-10 w-full rounded-t-2xl border border-border border-b-0 bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-card)] sm:px-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Friends climbing</p>
                  <p className="text-xs text-warm-gray">
                    {activeFriends.length} active · {friendPresence.length} total
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFriendsPanelOpen(false)}
                  className="rounded-full border border-border bg-background-solid/60 p-1.5 text-warm-gray transition-opacity hover:opacity-80"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {friendPresence.map((friend) => (
                  <li
                    key={friend.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background-solid/45 px-3 py-2"
                  >
                    <ClimberAvatar
                      name={friend.name}
                      size={30}
                      color={friend.status === "climbing" ? "#6bc49a" : "#9aa8b4"}
                      isActive={friend.status === "climbing"}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{friend.name}</p>
                      <p className="truncate text-[11px] text-warm-gray">
                        {friend.currentTask ?? "No active block"}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] ${
                        friend.status === "climbing"
                          ? "text-moss"
                          : friend.status === "summited"
                            ? "text-terracotta"
                            : "text-warm-gray"
                      }`}
                    >
                      {friend.status === "climbing"
                        ? "Climbing"
                        : friend.status === "summited"
                          ? "Summited"
                          : "Idle"}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => navigate("/friends")}
                className="mt-3 w-full rounded-full border border-border bg-background-solid/65 py-2 text-sm font-semibold text-foreground transition-opacity hover:opacity-85"
              >
                Open full friends screen
              </button>
            </div>
          </div>
        )}

        {showToast && (
          <FocusCheckToast type={toastType} lowPressureMode={prefs.lowPressureMode} />
        )}
      </div>

      {assistantOpen && (
        <StudyAssistantPanel onClose={() => setAssistantOpen(false)} />
      )}

      {activeRoast ? (
        <RoastModal
          onClose={() => setActiveRoast(null)}
          roastText={activeRoast.text}
          trigger={activeRoast.trigger}
          fromName={activeRoast.fromName}
        />
      ) : null}
    </>
  );
}
