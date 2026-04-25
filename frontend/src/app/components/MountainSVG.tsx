import { useEffect, useId, useRef, useState } from "react";
import { motion } from "motion/react";
import { ClimberAvatar } from "./ClimberAvatar";

interface MountainSVGProps {
  progress: number;
  climberName?: string;
  climberColor?: string;
  showTrail?: boolean;
  /**
   * When true, only trail / markers / climber draw — for layering over the
   * pixel-art `snow-mountain-retro-theme.png` background.
   */
  trailOnly?: boolean;
  isPaused?: boolean;
}

const trailPoints = [
  { x: 50, y: 95 },
  { x: 45, y: 88 },
  { x: 52, y: 82 },
  { x: 48, y: 75 },
  { x: 55, y: 68 },
  { x: 52, y: 62 },
  { x: 58, y: 55 },
  { x: 54, y: 48 },
  { x: 60, y: 42 },
  { x: 56, y: 35 },
  { x: 62, y: 28 },
  { x: 58, y: 22 },
  { x: 63, y: 15 },
  { x: 60, y: 10 },
  { x: 64, y: 5 },
];

function getPositionOnTrail(progress: number) {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const index = (clampedProgress / 100) * (trailPoints.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const t = index - lowerIndex;

  if (lowerIndex === upperIndex) {
    return trailPoints[lowerIndex];
  }

  const lower = trailPoints[lowerIndex];
  const upper = trailPoints[upperIndex];

  return {
    x: lower.x + (upper.x - lower.x) * t,
    y: lower.y + (upper.y - lower.y) * t,
  };
}

function footprintSamples(progress: number) {
  const from = Math.max(0, progress - 15);
  const out: { x: number; y: number; fade: number }[] = [];
  for (let p = from; p <= progress; p += 2.2) {
    const pos = getPositionOnTrail(Math.min(100, p));
    const fade = (p - from) / Math.max(0.01, progress - from);
    out.push({ ...pos, fade });
  }
  return out;
}

const trailStroke = (trail: boolean) => (trail ? "#c8e8ff" : "#FDFBF7");
const footprintFill = () => "#dceefc";
const milestoneFill = (trail: boolean) => (trail ? "#ffffff" : "#FDFBF7");

export function MountainSVG({
  progress,
  climberName = "You",
  climberColor = "#C66B52",
  showTrail = true,
  trailOnly = false,
  isPaused = false,
}: MountainSVGProps) {
  const uid = useId().replace(/:/g, "");
  const skyGradId = `sky-${uid}`;
  const position = getPositionOnTrail(progress);
  const lastProgressRef = useRef(progress);
  const [isWalking, setIsWalking] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const delta = Math.abs(progress - lastProgressRef.current);
    const moved = delta > 0.15;
    if (!isPaused && moved) {
      setIsWalking(true);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        setIsWalking(false);
      }, 220);
    } else if (isPaused) {
      setIsWalking(false);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    }
    lastProgressRef.current = progress;
  }, [progress, isPaused]);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, []);

  const trailPath = trailPoints
    .map((point, i) => `${i === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const prints = footprintSamples(progress);
  const tw = trailOnly;

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        {!trailOnly && (
          <>
            <defs>
              <linearGradient id={skyGradId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#2a3d47" />
                <stop offset="100%" stopColor="#1a242c" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" fill={`url(#${skyGradId})`} />

            <path
              d="M -8 82 L 8 58 L 20 62 L 14 100 L -8 100 Z"
              fill="var(--mountain)"
              opacity="0.35"
            />
            <path
              d="M 82 76 L 96 52 L 100 56 L 100 100 L 76 100 Z"
              fill="var(--mountain)"
              opacity="0.28"
            />

            <path
              d="M 0 85 Q 15 70, 25 68 L 30 60 Q 35 52, 40 48 L 45 40 Q 50 30, 55 25 L 60 15 Q 63 8, 65 5 L 68 10 Q 70 15, 72 18 L 75 25 Q 78 35, 80 40 L 85 50 Q 88 58, 90 62 L 95 70 Q 98 78, 100 85 L 100 100 L 0 100 Z"
              fill="var(--mountain)"
              opacity="0.9"
            />

            <path
              d="M 58 15 Q 60 10, 62 8 L 64 5 L 66 8 Q 68 12, 70 15 L 58 15 Z"
              fill="var(--snow)"
              opacity="0.95"
            />
            <path
              d="M 52 22 Q 56 16, 62 18 L 65 22 Q 60 26, 55 28 Q 53 24, 52 22 Z"
              fill="var(--snow)"
              opacity="0.78"
            />
          </>
        )}

        {showTrail && (
          <path
            d={trailPath}
            fill="none"
            stroke={trailStroke(tw)}
            strokeWidth={tw ? "0.42" : "0.3"}
            strokeDasharray={tw ? "0.8,1.2" : "1,1"}
            opacity={tw ? 0.88 : 0.6}
          />
        )}

        {prints.map((pt, i) => (
          <ellipse
            key={i}
            cx={pt.x}
            cy={pt.y + 0.35}
            rx={0.45}
            ry={0.22}
            fill={footprintFill()}
            opacity={tw ? 0.08 + pt.fade * 0.35 : 0.12 + pt.fade * 0.22}
            transform={`rotate(-12 ${pt.x} ${pt.y})`}
          />
        ))}

        {[25, 50, 75, 100].map((milestone) => {
          const pos = getPositionOnTrail(milestone);
          return (
            <circle
              key={milestone}
              cx={pos.x}
              cy={pos.y}
              r="0.8"
              fill={milestoneFill(tw)}
              opacity={tw ? 0.55 : 0.4}
            />
          );
        })}
      </svg>

      <motion.div
        className="absolute"
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          transform: trailOnly ? "translate(-54%, -76%)" : "translate(-50%, -50%)",
        }}
        initial={false}
        animate={{
          left: `${position.x}%`,
          top: `${position.y}%`,
        }}
        transition={{
          duration: 0.6,
          ease: [0.25, 0.1, 0.25, 1],
        }}
      >
        <motion.div
          animate={
            isWalking
              ? {
                  y: [-1, 1, -1],
                  rotate: [-0.6, 0.6, -0.6],
                }
              : { y: 0, rotate: 0 }
          }
          transition={{
            duration: 0.55,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        >
          <ClimberAvatar
            name={climberName}
            size={trailOnly ? 50 : 48}
            color={climberColor}
            variant={trailOnly ? "pixelCatWalk" : "initial"}
            isMoving={isWalking}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
