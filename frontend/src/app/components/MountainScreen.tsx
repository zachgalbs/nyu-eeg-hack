import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import {
  Pause,
  Play,
  ShieldCheck,
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
import { SNOW_MOUNTAIN_RETRO_THEME_SRC } from "../../lib/theme-asset";
import {
  getBuddyCommitment,
  getPrefs,
  saveSessionOutcome,
  updatePrefs,
} from "../../lib/compcal-state";

interface Friend {
  user_id: string;
  name: string;
  avatar_url: string | null;
  last_event: string | null;
  is_active: boolean;
}

function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function MountainScreen() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { title?: string; duration?: number } | null;

  const eventName = state?.title ?? "Focus Session";
  const eventDuration = state?.duration ?? 60;
  const eventKey = eventId ?? "active";

  // Demo cap: sessions run for at most 3 minutes to keep demos snappy
  const totalSeconds = Math.min(Math.max(45, eventDuration * 60), 180);

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
  const [friendsPanelOpen, setFriendsPanelOpen] = useState(false);
  const [prefs, setPrefs] = useState(() => getPrefs());
  const [buddyCommitment] = useState(() => getBuddyCommitment(eventKey));
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const summitSent = useRef(false);
  const [artReady, setArtReady] = useState(false);

  // Webcam refs for focus checks
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Fetch friends list for the panel
  useEffect(() => {
    fetch('/api/friends/list')
      .then(async (r) => {
        if (!r.ok) return;
        const data = await r.json();
        setFriends(data.friends ?? []);
      })
      .catch(() => {});
  }, []);

  // Start webcam when session begins
  useEffect(() => {
    if (!hasCheckedIn) return;
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => {}); // silently continue if no camera
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [hasCheckedIn]);

  // Timer
  useEffect(() => {
    if (isPaused || !hasCheckedIn) return;
    const id = window.setInterval(() => {
      setElapsedSeconds((prev) => (prev >= totalSeconds ? prev : prev + 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [totalSeconds, isPaused, hasCheckedIn]);

  // Progress
  useEffect(() => {
    setProgress(Math.min(100, (elapsedSeconds / totalSeconds) * 100));
  }, [elapsedSeconds, totalSeconds]);

  // Summit detection
  useEffect(() => {
    if (elapsedSeconds < totalSeconds || totalSeconds <= 0 || !hasCheckedIn || summitSent.current) return;
    summitSent.current = true;
    const completedMinutes = Math.max(
      1,
      Math.round((elapsedSeconds / Math.max(1, totalSeconds)) * eventDuration),
    );
    const keptCommitment = completedMinutes >= Math.round(eventDuration * 0.8) && focusScore >= 80;
    saveSessionOutcome({
      id: `${eventKey}-${Date.now()}`,
      eventId: eventKey,
      eventTitle: eventName,
      plannedMinutes: eventDuration,
      completedMinutes,
      focusScore,
      distractedChecks: distractedChecksTotal,
      keptCommitment,
      buddyId: buddyCommitment?.buddyId,
      buddyName: buddyCommitment?.buddyName,
      completedAt: new Date().toISOString(),
    });
    if (sessionId) {
      fetch('/api/sessions/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, focusScore }),
      }).catch(() => {});
    }
    navigate(`/summit/${eventId ?? "active"}`, {
      state: { title: eventName, duration: eventDuration },
    });
  }, [
    elapsedSeconds, totalSeconds, hasCheckedIn, eventId, eventDuration,
    eventName, eventKey, navigate, focusScore, distractedChecksTotal,
    buddyCommitment?.buddyId, buddyCommitment?.buddyName, sessionId,
  ]);

  // Capture a webcam frame and call the focus check API
  async function captureAndCheck(): Promise<boolean> {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return false;
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
    try {
      const res = await fetch('/api/check-focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      const { score } = await res.json();
      return (score ?? 0) > 0.5;
    } catch {
      return false;
    }
  }

  // Focus check interval — every 10s
  useEffect(() => {
    if (isPaused || !hasCheckedIn || !prefs.focusChecksEnabled) return;
    const id = window.setInterval(() => {
      captureAndCheck().then((isDistracted) => {
        const checkResult = isDistracted ? 'distracted' : 'verified';
        setLastCheck(checkResult);
        setToastType(checkResult);
        setShowToast(true);
        if (isDistracted) {
          setDistractedChecksTotal((prev) => prev + 1);
          setFocusScore((prev) => Math.max(70, prev - (prefs.lowPressureMode ? 1 : 3)));
          setDistractionCount((prev) => {
            const next = prev + 1;
            if (!prefs.lowPressureMode && next >= 3) { setShowRoast(true); return 0; }
            return next;
          });
        } else {
          setFocusScore((prev) => Math.min(100, prev + 1));
        }
        window.setTimeout(() => setShowToast(false), 2500);
      });
    }, 10000);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused, hasCheckedIn, prefs.focusChecksEnabled, prefs.lowPressureMode]);

  const toggleFocusChecks = () => {
    const next = updatePrefs({ focusChecksEnabled: !prefs.focusChecksEnabled });
    setPrefs(next);
  };

  const handleCheckIn = () => {
    setHasCheckedIn(true);
    setCheckedInAt(new Date());
    fetch('/api/sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventTitle: eventName }),
    })
      .then((r) => r.json())
      .then((data) => { if (data.sessionId) setSessionId(data.sessionId); })
      .catch(() => {});
  };

  const blockMinutes = Math.floor(elapsedSeconds / 60);
  const blockLabel =
    blockMinutes >= 60
      ? `${Math.floor(blockMinutes / 60)}h ${blockMinutes % 60}m this block`
      : `${blockMinutes}m this block`;

  const timeline = [
    { id: "checkin", label: "Check in", Icon: Flag, state: hasCheckedIn ? "done" : "current" },
    { id: "focus", label: "Focus climb", Icon: Timer, state: hasCheckedIn ? (progress >= 98 ? "done" : "current") : "upcoming" },
    { id: "summit", label: "Summit", Icon: Trophy, state: progress >= 98 ? "done" : "upcoming" },
  ] as const;

  const activeFriends = useMemo(() => friends.filter((f) => f.is_active), [friends]);
  const stripFriends = activeFriends.slice(0, 4);
  const overflowActiveCount = Math.max(0, activeFriends.length - stripFriends.length);
  const canExit = hasCheckedIn && elapsedSeconds > 0;

  const exitSession = () => {
    if (!canExit) { navigate("/calendar"); return; }
    const confirmed = window.confirm(
      "Exit this session now? Your in-progress climb will be saved as a partial session.",
    );
    if (!confirmed) return;
    const completedMinutes = Math.max(
      1,
      Math.round((elapsedSeconds / Math.max(1, totalSeconds)) * eventDuration),
    );
    saveSessionOutcome({
      id: `${eventKey}-partial-${Date.now()}`,
      eventId: eventKey,
      eventTitle: eventName,
      plannedMinutes: eventDuration,
      completedMinutes,
      focusScore,
      distractedChecks: distractedChecksTotal,
      keptCommitment: false,
      buddyId: buddyCommitment?.buddyId,
      buddyName: buddyCommitment?.buddyName,
      completedAt: new Date().toISOString(),
    });
    if (sessionId) {
      fetch('/api/sessions/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, focusScore }),
      }).catch(() => {});
    }
    navigate("/calendar");
  };

  return (
    <>
      {/* Hidden webcam elements */}
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

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
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
            artReady ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className="overflow-hidden rounded-2xl border-2 border-border/40"
            style={{
              width: "min(85vw, 360px)",
              height: "min(85vw, 360px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <MountainSVG
              progress={progress}
              climberName="You"
              climberColor="#c4b5e8"
              trailOnly
              isPaused={!hasCheckedIn || isPaused}
            />
          </div>
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
                {eventName}
              </h2>
              <div
                className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2 text-muted"
                style={{ fontSize: "13px", fontFamily: "var(--font-mono)" }}
              >
                <span className="text-foreground/90">
                  {hasCheckedIn ? blockLabel : "check in to start timer"}
                </span>
              </div>
              {!hasCheckedIn ? (
                <button
                  type="button"
                  onClick={handleCheckIn}
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
                        key={friend.user_id}
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
            </div>
          </div>
        </div>

        <div className="absolute bottom-36 left-4 right-4 z-10 mx-auto max-w-6xl rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] backdrop-blur-md sm:left-6 sm:right-6">
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
                style={{ fontFamily: "var(--font-mono)", fontSize: "24px", fontWeight: 600 }}
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

        <div className="absolute bottom-56 left-4 right-4 z-10 mx-auto max-w-6xl rounded-2xl border border-border bg-card/90 px-4 py-3 backdrop-blur-md sm:left-6 sm:right-6">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-warm-gray">Timeline</p>
          <div className="grid grid-cols-3 gap-2">
            {timeline.map(({ id, label, Icon, state: tState }) => (
              <div
                key={id}
                className={`rounded-xl border px-2 py-2 text-center ${
                  tState === "done"
                    ? "border-moss/60 bg-moss/15"
                    : tState === "current"
                      ? "border-terracotta/60 bg-terracotta/10"
                      : "border-border bg-background-solid/40"
                }`}
              >
                <Icon
                  className={`mx-auto mb-1 h-4 w-4 ${
                    tState === "done"
                      ? "text-moss"
                      : tState === "current"
                        ? "text-terracotta"
                        : "text-warm-gray"
                  }`}
                />
                <p className="text-[11px] text-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-20 left-4 right-4 z-10 mx-auto max-w-6xl rounded-xl border border-border bg-card/95 px-3 py-2 text-xs text-warm-gray backdrop-blur-md sm:left-6 sm:right-6">
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
                    {activeFriends.length} active · {friends.length} total
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
                {friends.map((friend) => (
                  <li
                    key={friend.user_id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background-solid/45 px-3 py-2"
                  >
                    <ClimberAvatar
                      name={friend.name}
                      size={30}
                      color={friend.is_active ? "#6bc49a" : "#9aa8b4"}
                      isActive={friend.is_active}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{friend.name}</p>
                      <p className="truncate text-[11px] text-warm-gray">
                        {friend.last_event ?? "No active block"}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] ${friend.is_active ? "text-moss" : "text-warm-gray"}`}
                    >
                      {friend.is_active ? "Climbing" : "Idle"}
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

      {showRoast && (
        <RoastModal
          onClose={() => setShowRoast(false)}
          friends={activeFriends.map((f) => f.name)}
        />
      )}
    </>
  );
}
