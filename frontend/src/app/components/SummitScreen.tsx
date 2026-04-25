import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import { MountainSVG } from "./MountainSVG";
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

export function SummitScreen() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const event = eventData[eventId ?? ""] ?? eventData["1"];

  const [showMountain, setShowMountain] = useState(false);
  const [showText, setShowText] = useState(false);
  const [showScore, setShowScore] = useState(false);

  const focusedTime = event?.duration || 120;
  const focusScore = (location.state as { focusScore?: number } | null)?.focusScore ?? 94;

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
            {event?.name || "Focus Session"}
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
              {Math.floor(focusedTime / 60)}h {focusedTime % 60}m
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
