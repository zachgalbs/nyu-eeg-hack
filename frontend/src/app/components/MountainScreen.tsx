import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import {
  Pause,
  Play,
  HandHeart,
  LogOut,
  X,
} from "lucide-react";
import { MountainSVG } from "./MountainSVG";
import { ClimberAvatar } from "./ClimberAvatar";
import { FocusCheckToast } from "./FocusCheckToast";
import { RoastModal } from "./RoastModal";
import { SNOW_MOUNTAIN_RETRO_THEME_SRC } from "../../lib/theme-asset";
import {
  getBuddyCommitment,
  saveSessionOutcome,
} from "../../lib/compcal-state";
import { type FriendPresence } from "../../lib/friends-presence";
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

function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return 'Never online';
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 2) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 6) return `${diffHours}h ago`;
  const timeStr = then.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const thenDate = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayDiff = Math.round((todayDate.getTime() - thenDate.getTime()) / 86400000);
  if (dayDiff === 0) return `today at ${timeStr}`;
  if (dayDiff === 1) return `yesterday at ${timeStr}`;
  return `${then.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at ${timeStr}`;
}

export function MountainScreen() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state ?? null) as { title?: string; duration?: number; playMeetUp?: boolean } | null;
  const eventKey = eventId ?? "active";
  const fallbackEvent = eventData[eventKey] ?? eventData.active;
  const event = {
    name: navState?.title || fallbackEvent.name,
    duration: navState?.duration || fallbackEvent.duration,
  };

  const totalSeconds = Math.max(45, event.duration * 60);
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
  const [friendsPanelOpen, setFriendsPanelOpen] = useState(false);
  const [buddyCommitment] = useState(() => getBuddyCommitment(eventKey));
  const summitSent = useRef(false);
  const elapsedSecondsRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uiVisible, setUiVisible] = useState(true);
  const [debugImage, setDebugImage] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [debugScore, setDebugScore] = useState<{ score: number; raw: string } | null>(null);
  const [showGeminiInfo, setShowGeminiInfo] = useState(false);
  const [artReady, setArtReady] = useState(false);
  const [throwTargetId, setThrowTargetId] = useState<string | null>(null);
  const [isThrowing, setIsThrowing] = useState(false);
  const [projectile, setProjectile] = useState<{ fromProgress: number; toProgress: number; active: boolean } | null>(null);
  const [snowballMode, setSnowballMode] = useState<'throw' | 'hit' | null>(null);
  const snowballVideoRef = useRef<HTMLVideoElement>(null);
  const [meetUpActive, setMeetUpActive] = useState<boolean>(() => Boolean(navState?.playMeetUp));
  const meetUpVideoRef = useRef<HTMLVideoElement>(null);
  const [realFriends, setRealFriends] = useState<FriendPresence[]>([]);
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
    v.muted = bgMode === 'climbing';
    v.load();
    v.play().catch(() => {});
  }, [bgMode]);
  useEffect(() => {
    const v = snowballVideoRef.current;
    if (!v || !snowballMode) return;
    v.src = snowballMode === 'throw'
      ? '/media/Cat_throws_snowball.mp4'
      : '/media/Cat_hit_by_snowball.mp4';
    v.load();
    v.play().catch(() => {});
  }, [snowballMode]);

  useEffect(() => {
    if (!meetUpActive) return;
    const v = meetUpVideoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.load();
    v.play().catch(() => setMeetUpActive(false));
  }, [meetUpActive]);

  useEffect(() => {
    let cancelled = false;
    type ApiFriend = {
      user_id: string;
      name: string;
      last_event: string | null;
      is_active: boolean;
      last_summit: string | null;
    };
    const fetchFriends = () => {
      fetch('/api/friends/list')
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { friends: ApiFriend[] } | null) => {
          if (cancelled || !data?.friends) return;
          setRealFriends(
            data.friends.map((f) => ({
              id: f.user_id,
              name: f.name,
              currentTask: f.last_event,
              focusedTimeToday: 0,
              altitude: 0,
              status: f.is_active ? 'climbing' : (f.last_summit ? 'summited' : 'idle'),
              lastSeenAt: f.last_summit,
            }))
          );
        })
        .catch(() => {});
    };
    fetchFriends();
    const id = window.setInterval(fetchFriends, 30000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  const sessionIdRef = useRef<number | string | null>(null);

  useEffect(() => {
    if (!hasCheckedIn) return;
    let cancelled = false;
    fetch('/api/sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventTitle: event.name }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data?.sessionId) sessionIdRef.current = data.sessionId; })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [hasCheckedIn, event.name]);

  useEffect(() => {
    const endSession = () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      sessionIdRef.current = null;
      const body = JSON.stringify({ sessionId: sid });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/sessions/end', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/sessions/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', endSession);
    return () => {
      window.removeEventListener('beforeunload', endSession);
      endSession();
    };
  }, []);

  useEffect(() => {
    if (isPaused || !hasCheckedIn) return;
    const id = window.setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev >= totalSeconds ? prev : prev + 1;
        elapsedSecondsRef.current = next;
        return next;
      });
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

  // Start webcam on mount so debug check works immediately
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => {});
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // Auto-hide UI after 4s of inactivity (only during active session)
  useEffect(() => {
    if (meetUpActive) return; // overlay effect owns uiVisible while the video plays
    if (!hasCheckedIn || isPaused) {
      setUiVisible(true);
      return;
    }
    const resetTimer = () => {
      setUiVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setUiVisible(false), 4000);
    };
    resetTimer();
    const events = ['mousemove', 'mousedown', 'touchstart', 'keydown'] as const;
    events.forEach((e) => document.addEventListener(e, resetTimer, { passive: true }));
    return () => {
      events.forEach((e) => document.removeEventListener(e, resetTimer));
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [hasCheckedIn, isPaused, meetUpActive]);

  // Hide the UI immediately when an overlay animation (snowball / break transitions) plays
  useEffect(() => {
    const animationActive = snowballMode !== null || bgMode === 'going_to_break' || bgMode === 'going_from_break' || meetUpActive;
    if (animationActive) {
      setUiVisible(false);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else if (!hasCheckedIn || isPaused) {
      // Restore UI when animation ends and session is paused or not yet started
      setUiVisible(true);
    }
  }, [snowballMode, bgMode, meetUpActive, isPaused, hasCheckedIn]);

  async function captureAndCheck(): Promise<boolean> {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) throw new Error('No camera element');
    if (video.readyState < 2) {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          video.removeEventListener('loadeddata', onLoaded);
          reject(new Error('Camera not ready — allow camera access and try again'));
        }, 6000);
        const onLoaded = () => { clearTimeout(timer); resolve(); };
        video.addEventListener('loadeddata', onLoaded, { once: true });
      });
    }

    const captureFrame = () => {
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.7);
    };

    const dataUrl1 = captureFrame();
    setDebugImage(dataUrl1);
    const imageBase64 = dataUrl1.split(',')[1];

    await new Promise<void>((resolve) => window.setTimeout(resolve, 1000));

    const dataUrl2 = captureFrame();
    const imageBase64b = dataUrl2.split(',')[1];

    const res = await fetch('/api/check-focus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, imageBase64b, eventName: event.name }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    const score = typeof data.score === 'number' ? data.score : 0;
    setDebugScore({ score, raw: typeof data.raw === 'string' ? data.raw : '' });
    return score > 0.5;
  }

  useEffect(() => {
    if (isPaused || !hasCheckedIn) return;

    const runCheck = () => {
      captureAndCheck().then((isDistracted) => {
        const checkResult = isDistracted ? 'distracted' : 'verified';
        setLastCheck(checkResult);
        setToastType(checkResult);
        setShowToast(true);

        if (isDistracted) {
          setDistractedChecksTotal((prev) => prev + 1);
          setFocusScore((prev) => Math.max(70, prev - 3));
          setDistractionCount((prev) => {
            const newCount = prev + 1;
            if (newCount >= 3) {
              void (async () => {
                const roastText = await generateRoast({
                  userName: "You",
                  userBlock: event.name,
                  minutesIn: Math.floor(elapsedSecondsRef.current / 60),
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
      }).catch(() => {});
    };

    // Check immediately on check-in, then at a random interval between 2-3 minutes
    const scheduleNext = () => {
      const delay = (120 + Math.random() * 60) * 1000;
      return window.setTimeout(() => { runCheck(); focusCheckRef.current = scheduleNext(); }, delay);
    };
    runCheck();
    const focusCheckRef = { current: scheduleNext() };
    return () => window.clearTimeout(focusCheckRef.current);
  }, [isPaused, hasCheckedIn, event.name]);

  const blockMinutes = Math.floor(elapsedSeconds / 60);

  const friendPresence = useMemo(
    () => [...realFriends].sort((a, b) => {
      if (a.status === 'climbing' && b.status !== 'climbing') return -1;
      if (a.status !== 'climbing' && b.status === 'climbing') return 1;
      return 0;
    }),
    [realFriends]
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


  useEffect(() => {
    const unsubscribe = subscribeRoasts((payload) => {
      if (payload.toUserId !== localUserId && payload.toUserId !== "broadcast") return;
      if (payload.fromUserId === localUserId) return;
      if (payload.trigger === 'friend_throw') {
        setSnowballMode('hit');
        return;
      }
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
        if (incoming.trigger === 'friend_throw') {
          setSnowballMode('hit');
          return;
        }
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
    setSnowballMode('throw');
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
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />
      <video
        ref={snowballVideoRef}
        className={`pointer-events-none fixed inset-0 z-[60] h-full w-full object-cover transition-opacity duration-150 ${snowballMode ? "opacity-100" : "opacity-0"}`}
        playsInline
        onEnded={() => setSnowballMode(null)}
      />
      {meetUpActive && (
        <div className="fixed inset-0 z-[65] bg-black">
          <video
            ref={meetUpVideoRef}
            src="/media/meeting_with_friends.mp4"
            className="absolute inset-0 h-full w-full object-cover"
            playsInline
            autoPlay
            onEnded={() => setMeetUpActive(false)}
            onError={() => setMeetUpActive(false)}
          />
          <button
            type="button"
            onClick={() => setMeetUpActive(false)}
            className="absolute right-4 top-4 rounded-full bg-white/15 px-3 py-1 text-xs text-white backdrop-blur hover:bg-white/25"
          >
            Skip
          </button>
        </div>
      )}
      <div className={`fixed inset-0 z-30 overflow-y-auto bg-background-solid ${!uiVisible ? "cursor-none" : ""}`}>
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
          playsInline
          onLoadedData={() => { if (!artReady) setArtReady(true); }}
          onEnded={() => {
            if (bgMode === 'going_to_break') setBgMode('static');
            if (bgMode === 'going_from_break') setBgMode('climbing');
          }}
        />

        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background-solid/10 via-background-solid/20 to-background-solid/55"
          aria-hidden
        />

        <div className={`relative z-10 min-h-full px-4 pb-28 pt-4 sm:px-6 sm:pt-5 transition-opacity duration-700 ${uiVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
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
              <div className="mb-1 flex items-baseline gap-2">
                <span
                  className={`tabular-nums tracking-tight ${isPaused ? "text-warm-gray" : "text-foreground"}`}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "clamp(1.75rem, 5.2vw, 2.35rem)",
                    fontWeight: 700,
                    lineHeight: 1.05,
                  }}
                >
                  {hasCheckedIn ? `${blockMinutes}m` : "0m"}
                </span>
                <span
                  className="tabular-nums text-warm-gray"
                  style={{ fontFamily: "var(--font-mono)", fontSize: "clamp(0.85rem, 2.5vw, 1.05rem)", fontWeight: 400 }}
                >
                  / {event.duration}m
                </span>
              </div>
              <h2
                className="mb-1 truncate text-foreground/70"
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "15px",
                  fontWeight: 400,
                }}
              >
                {event.name}
              </h2>
              <div
                className={`mb-2 tabular-nums text-[11px] ${isPaused ? "text-warm-gray" : "text-warm-gray/70"}`}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {formatHMS(elapsedSeconds)}
              </div>
              <div className="border-t border-border pt-2">
                <div className="h-1 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-moss transition-[width] duration-1000 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                </div>
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
          <div className="fixed inset-x-0 bottom-24 z-20 px-4 sm:px-6">
            <div className="mx-auto w-full max-w-6xl">
            <div className="flex items-stretch rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] backdrop-blur-md">
              <div className="min-w-0 flex-1 p-4">

                <div>
                  <div className="flex items-center gap-4">
                    <div
                      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-mountain/50 text-[10px] text-foreground"
                      style={{ width: 200, height: 140 }}
                    >
                      {debugImage ? (
                        <img src={debugImage} alt="Captured frame" className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <div
                            className={`mx-auto mb-1 h-2 w-2 rounded-full bg-primary ${isPaused ? "" : "animate-pulse"}`}
                          />
                          {isPaused ? "PAUSED" : "LIVE"}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-1.5">
                        <span
                          className={`font-semibold ${lastCheck === "verified" ? "text-moss" : "text-coral"}`}
                          style={{ fontSize: "24px", fontWeight: 600 }}
                        >
                          {lastCheck === "verified" ? "Focused" : "Not focused"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowGeminiInfo((v) => !v)}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors ${showGeminiInfo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background-solid/70 text-warm-gray hover:border-primary hover:text-primary"}`}
                          aria-label="Show Gemini classification details"
                        >
                          i
                        </button>
                      </div>

                      {showGeminiInfo && (
                        <div className="mb-2 rounded-xl border border-border bg-background-solid/80 p-3 text-[11px]">
                          <p className="mb-1 font-semibold text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                            Gemini 2.5 Flash
                          </p>
                          {isChecking ? (
                            <p className="text-warm-gray">Checking...</p>
                          ) : debugScore ? (
                            <>
                              <div className="mb-1.5 flex items-center gap-2">
                                <span className="text-warm-gray">Score:</span>
                                <span className={`font-semibold ${debugScore.score > 0.5 ? "text-coral" : "text-moss"}`}>
                                  {debugScore.score.toFixed(2)}
                                </span>
                                <span className="text-warm-gray">→</span>
                                <span className={`font-semibold ${debugScore.score > 0.5 ? "text-coral" : "text-moss"}`}>
                                  {debugScore.score > 0.5 ? "distracted" : "focused"}
                                </span>
                              </div>
                              {debugScore.raw && (
                                <div>
                                  <p className="mb-0.5 text-warm-gray">Raw response:</p>
                                  <p className="font-mono text-foreground">{debugScore.raw}</p>
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-warm-gray">No check run yet — tap "check now" below.</p>
                          )}
                          {debugError && (
                            <p className="mt-1 text-coral">{debugError}</p>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={isChecking}
                        onClick={async () => {
                          setIsChecking(true);
                          setDebugError(null);
                          try {
                            const isDistracted = await captureAndCheck();
                            const result = isDistracted ? 'distracted' : 'verified';
                            setLastCheck(result);
                            setToastType(result);
                            setShowToast(true);
                            window.setTimeout(() => setShowToast(false), 2500);
                          } catch (err) {
                            setDebugError(err instanceof Error ? err.message : 'Check failed');
                          } finally {
                            setIsChecking(false);
                          }
                        }}
                        className="mt-2 rounded-full border border-border bg-background-solid/70 px-3 py-1 text-[11px] text-warm-gray transition-opacity hover:opacity-80 disabled:opacity-50"
                      >
                        {isChecking ? 'Checking...' : 'check now'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-end p-3">
                <div
                  className={`relative overflow-hidden rounded-xl border-2 border-border/40 transition-opacity duration-500 ${
                    artReady ? "opacity-100" : "opacity-0"
                  }`}
                  style={{
                    width: 260,
                    height: 182,
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
                      className={`shrink-0 text-right text-[11px] ${
                        friend.status === "climbing"
                          ? "text-moss"
                          : "text-warm-gray"
                      }`}
                    >
                      {friend.status === "climbing"
                        ? "Online now"
                        : formatLastSeen(friend.lastSeenAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {showToast && (
          <FocusCheckToast type={toastType} lowPressureMode={false} />
        )}
      </div>

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
