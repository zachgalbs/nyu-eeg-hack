import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { Pause, Play } from "lucide-react";
import { MountainSVG } from "./MountainSVG";
import { FocusCheckToast } from "./FocusCheckToast";
import { RoastModal } from "./RoastModal";
import { StudyAssistantPanel } from "./StudyAssistantPanel";
import { SNOW_MOUNTAIN_RETRO_THEME_SRC } from "../../lib/theme-asset";

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

async function checkFocusViaAPI(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<{ isDistracted: boolean; score: number; dataUrl: string }> {
  canvas.width = video.videoWidth || 320;
  canvas.height = video.videoHeight || 240;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
  const base64 = dataUrl.split(',')[1];

  const res = await fetch('/api/check-focus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64 }),
  });
  const data = await res.json();
  const score = data.score ?? 0;
  return { isDistracted: score >= 0.5, score, dataUrl };
}

export function MountainScreen() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const stateTitle = (location.state as { title?: string } | null)?.title;

  const event = eventData[eventId ?? ""] ?? {
    name: stateTitle ?? "Focus Session",
    duration: 60,
  };

  const totalSeconds = Math.min(Math.max(45, event.duration * 60), 180);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [focusScore, setFocusScore] = useState(97);
  const [lastCheck, setLastCheck] = useState<'verified' | 'distracted'>('verified');
  const [lastRawScore, setLastRawScore] = useState<number | null>(null);
  const [lastFrameSrc, setLastFrameSrc] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState<'verified' | 'distracted'>('verified');
  const [distractedCount, setDistractionCount] = useState(0);
  const [showRoast, setShowRoast] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const summitSent = useRef(false);
  const [artReady, setArtReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {});

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const id = window.setInterval(() => {
      setElapsedSeconds((prev) => (prev >= totalSeconds ? prev : prev + 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [totalSeconds, isPaused]);

  useEffect(() => {
    setProgress(Math.min(100, (elapsedSeconds / totalSeconds) * 100));
  }, [elapsedSeconds, totalSeconds]);

  useEffect(() => {
    if (
      elapsedSeconds >= totalSeconds &&
      totalSeconds > 0 &&
      !summitSent.current
    ) {
      summitSent.current = true;
      navigate(`/summit/${eventId ?? "me-1"}`, { state: { focusScore } });
    }
  }, [elapsedSeconds, totalSeconds, eventId, focusScore, navigate]);

  async function runFocusCheck() {
    if (checking) return;
    setChecking(true);

    let isDistracted: boolean;
    let rawScore: number | null = null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const hasCamera = streamRef.current && video && canvas && video.readyState >= 2;

    if (hasCamera) {
      try {
        const result = await checkFocusViaAPI(video!, canvas!);
        isDistracted = result.isDistracted;
        rawScore = result.score;
        setLastFrameSrc(result.dataUrl);
      } catch {
        isDistracted = Math.random() < 0.15;
      }
    } else {
      isDistracted = Math.random() < 0.15;
    }

    setLastRawScore(rawScore);
    const checkResult = isDistracted ? 'distracted' : 'verified';
    setLastCheck(checkResult);
    setToastType(checkResult);
    setShowToast(true);

    if (isDistracted) {
      setFocusScore((prev) => Math.max(70, prev - 3));
      setDistractionCount((prev) => {
        const newCount = prev + 1;
        if (newCount >= 3) {
          setShowRoast(true);
          return 0;
        }
        return newCount;
      });
    } else {
      setFocusScore((prev) => Math.min(100, prev + 1));
    }

    window.setTimeout(() => setShowToast(false), 2500);
    setChecking(false);
  }

  useEffect(() => {
    if (isPaused) return;
    const id = window.setInterval(runFocusCheck, 60000);
    return () => window.clearInterval(id);
  }, [isPaused]); // eslint-disable-line react-hooks/exhaustive-deps

  const blockMinutes = Math.floor(elapsedSeconds / 60);
  const blockLabel =
    blockMinutes >= 60
      ? `${Math.floor(blockMinutes / 60)}h ${blockMinutes % 60}m this block`
      : `${blockMinutes}m this block`;

  return (
    <>
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
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
          className={`absolute inset-0 transition-opacity duration-500 ${
            artReady ? "opacity-100" : "opacity-0"
          }`}
        >
          <MountainSVG
            progress={progress}
            climberName="You"
            climberColor="#c4b5e8"
            trailOnly
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
                <span className="text-foreground/90">{blockLabel}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                type="button"
                onClick={() => setIsPaused((p) => !p)}
                className="flex items-center justify-center rounded-full border border-border bg-card px-3 py-2 text-foreground transition-opacity hover:opacity-80"
                aria-label={isPaused ? "Resume session" : "Pause session"}
                aria-pressed={isPaused}
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
              <button
                type="button"
                onClick={runFocusCheck}
                disabled={checking}
                className="rounded-full border border-border bg-card px-3 py-2 text-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ fontSize: "13px", fontWeight: 600 }}
              >
                {checking ? "…" : "Check"}
              </button>
            </div>
          </div>
        </div>

        <div className="absolute bottom-24 left-4 right-4 z-10 mx-auto max-w-6xl rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] backdrop-blur-md sm:left-6 sm:right-6">
          <div className="flex items-center gap-4">
            {lastFrameSrc ? (
              <img
                src={lastFrameSrc}
                alt="Last focus check snapshot"
                className="shrink-0 rounded-lg object-cover"
                style={{ width: 80, height: 60 }}
              />
            ) : (
              <div
                className="flex shrink-0 items-center justify-center rounded-lg bg-mountain/50 text-[10px] text-foreground"
                style={{ width: 80, height: 60 }}
              >
                <div className="text-center">
                  <div
                    className={`mx-auto mb-1 h-2 w-2 rounded-full bg-primary ${isPaused ? "" : "animate-pulse"}`}
                  />
                  {isPaused ? "PAUSED" : "LIVE"}
                </div>
              </div>
            )}

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
                  {lastRawScore !== null && (
                    <span className="ml-2 opacity-60">
                      (Claude: {lastRawScore.toFixed(2)})
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {showToast && <FocusCheckToast type={toastType} />}
      </div>

      {assistantOpen && (
        <StudyAssistantPanel onClose={() => setAssistantOpen(false)} />
      )}

      {showRoast && <RoastModal onClose={() => setShowRoast(false)} />}
    </>
  );
}
