import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import { MountainSVG } from "./MountainSVG";

const eventData: Record<string, any> = {
  '1': { name: "Deep Work: Design System", duration: 120 },
  '2': { name: "Team Standup", duration: 30 },
  '3': { name: "Focus Block: Code Review", duration: 120 },
};

export function SummitScreen() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const event = eventData[eventId || '1'];

  const [showMountain, setShowMountain] = useState(false);
  const [showClimber, setShowClimber] = useState(false);
  const [showText, setShowText] = useState(false);
  const [showScore, setShowScore] = useState(false);

  const focusedTime = event?.duration || 120;
  const focusScore = 94;

  useEffect(() => {
    setTimeout(() => setShowMountain(true), 100);
    setTimeout(() => setShowClimber(true), 400);
    setTimeout(() => setShowText(true), 800);
    setTimeout(() => setShowScore(true), 1200);
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden flex flex-col items-center justify-center">
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: showMountain ? 1 : 0 }}
        transition={{ duration: 0.4 }}
      >
        <MountainSVG progress={100} climberName="You" />
      </motion.div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          className="absolute"
          style={{ top: '20%', opacity: 0.15 }}
        >
          <circle cx="100" cy="100" r="80" fill="#F4D8BA" />
          <circle cx="100" cy="100" r="60" fill="#FBF2E4" opacity="0.8" />
          <circle cx="100" cy="100" r="40" fill="#F4D8BA" opacity="0.6" />
        </svg>
      </div>

      <div className="relative z-10 text-center px-6 max-w-md">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showText ? 1 : 0, y: showText ? 0 : 20 }}
          transition={{ duration: 0.4 }}
          className="text-terracotta mb-4"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '56px',
            fontWeight: 400,
            lineHeight: 1,
          }}
        >
          summited
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showScore ? 1 : 0, y: showScore ? 0 : 20 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h2
            className="text-ink mb-3"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '20px',
              fontWeight: 400,
            }}
          >
            {event?.name || 'Focus Session'}
          </h2>

          <div className="space-y-2">
            <div
              className="text-ink"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '28px',
                fontWeight: 600,
              }}
            >
              {Math.floor(focusedTime / 60)}h {focusedTime % 60}m
            </div>
            <div
              className="text-moss"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '28px',
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
          transition={{ duration: 0.4, delay: 0.2 }}
          className="space-y-3"
        >
          <button
            className="w-full py-3 px-6 border-2 border-ink text-ink transition-all hover:bg-ink hover:text-snow"
            style={{ borderRadius: '999px', fontWeight: 600 }}
          >
            share to friends' mountains
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 px-6 bg-terracotta text-snow transition-opacity hover:opacity-90"
            style={{ borderRadius: '999px', fontWeight: 600 }}
          >
            back to today
          </button>
        </motion.div>
      </div>
    </div>
  );
}
