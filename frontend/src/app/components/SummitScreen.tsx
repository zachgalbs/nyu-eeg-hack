import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import { CheckCircle2 } from "lucide-react";
import { MountainSVG } from "./MountainSVG";
import { SNOW_MOUNTAIN_RETRO_THEME_SRC } from "../../lib/theme-asset";
import { getLatestSessionOutcome } from "../../lib/compcal-state";

export function SummitScreen() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { title?: string; duration?: number } | null;

  const [showMountain, setShowMountain] = useState(false);
  const [showText, setShowText] = useState(false);
  const [showScore, setShowScore] = useState(false);

  const sessionOutcome = getLatestSessionOutcome(eventId);
  const eventName = state?.title ?? sessionOutcome?.eventTitle ?? "Focus Session";
  const eventDuration = state?.duration ?? sessionOutcome?.plannedMinutes ?? 60;
  const focusScore = sessionOutcome?.focusScore ?? 0;
  const plannedMinutes = sessionOutcome?.plannedMinutes ?? eventDuration;
  const completedMinutes = sessionOutcome?.completedMinutes ?? 0;
  const distractedChecks = sessionOutcome?.distractedChecks ?? 0;
  const keptCommitment = sessionOutcome?.keptCommitment ?? false;

  useEffect(() => {
    setTimeout(() => setShowMountain(true), 100);
    setTimeout(() => setShowText(true), 800);
    setTimeout(() => setShowScore(true), 1200);
  }, []);

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-background-solid">
      <img
        src={SNOW_MOUNTAIN_RETRO_THEME_SRC}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background-solid/35 via-background-solid/50 to-background-solid/80"
        aria-hidden
      />

      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: showMountain ? 1 : 0 }}
        transition={{ duration: 0.4 }}
      >
        <MountainSVG
          progress={100}
          climberName="You"
          climberColor="#c4b5e8"
          trailOnly
        />
      </motion.div>

      <div className="relative z-10 max-w-md px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: showText ? 1 : 0, y: showText ? 0 : 12 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-4 text-primary"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "clamp(2rem, 8vw, 2.75rem)",
            fontWeight: 400,
            lineHeight: 1,
          }}
        >
          summited
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: showScore ? 1 : 0, y: showScore ? 0 : 12 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-8"
        >
          <h2
            className="mb-3 text-foreground"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "20px",
              fontWeight: 400,
            }}
          >
            {eventName}
          </h2>

          <div className="space-y-2">
            <div
              className="text-foreground tabular-nums"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "28px",
                fontWeight: 600,
              }}
            >
              {Math.floor(completedMinutes / 60)}h {completedMinutes % 60}m
            </div>
            <div
              className="text-moss tabular-nums"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "28px",
                fontWeight: 600,
              }}
            >
              {focusScore}% focused
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: showScore ? 1 : 0, y: showScore ? 0 : 12 }}
          transition={{ duration: 0.3, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-6 rounded-2xl border border-border bg-card/85 p-4 text-left"
        >
          <p className="mb-2 text-[11px] uppercase tracking-wide text-warm-gray">
            Session outcome
          </p>
          <div className="grid grid-cols-2 gap-3 text-[13px] text-foreground">
            <div>
              <p className="text-warm-gray">Planned</p>
              <p className="font-semibold">{plannedMinutes}m</p>
            </div>
            <div>
              <p className="text-warm-gray">Completed</p>
              <p className="font-semibold">{completedMinutes}m</p>
            </div>
            <div>
              <p className="text-warm-gray">Distraction checks</p>
              <p className="font-semibold">{distractedChecks}</p>
            </div>
            <div>
              <p className="text-warm-gray">Commitment</p>
              <p className={`font-semibold ${keptCommitment ? "text-moss" : "text-coral"}`}>
                {keptCommitment ? "Kept" : "Needs reset"}
              </p>
            </div>
          </div>
          {sessionOutcome?.buddyName ? (
            <p className="mt-3 flex items-center gap-2 text-[12px] text-moss">
              <CheckCircle2 className="h-4 w-4" />
              You and {sessionOutcome.buddyName} both see this completion.
            </p>
          ) : null}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showScore ? 1 : 0 }}
          transition={{ duration: 0.35, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
          className="space-y-3"
        >
          <button
            type="button"
            className="w-full border-2 border-border py-3 px-6 text-foreground transition-opacity hover:opacity-85"
            style={{ borderRadius: "999px", fontWeight: 600 }}
          >
            share to friends&apos; mountains
          </button>
          <button
            type="button"
            onClick={() => navigate("/calendar")}
            className="w-full bg-primary py-3 px-6 text-primary-foreground transition-opacity hover:opacity-90"
            style={{ borderRadius: "999px", fontWeight: 600 }}
          >
            back to calendar
          </button>
        </motion.div>
      </div>
    </div>
  );
}
