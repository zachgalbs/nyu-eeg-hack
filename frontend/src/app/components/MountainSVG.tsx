import { motion } from "motion/react";
import { ClimberAvatar } from "./ClimberAvatar";

interface MountainSVGProps {
  progress: number;
  climberName?: string;
  climberColor?: string;
  showTrail?: boolean;
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

export function MountainSVG({
  progress,
  climberName = "You",
  climberColor = "#C66B52",
  showTrail = true,
}: MountainSVGProps) {
  const position = getPositionOnTrail(progress);

  const trailPath = trailPoints
    .map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <div className="relative w-full h-full">
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F4D8BA" />
            <stop offset="100%" stopColor="#FBF2E4" />
          </linearGradient>
        </defs>

        <rect width="100" height="100" fill="url(#skyGradient)" />

        <path
          d="M 0 85 Q 15 70, 25 68 L 30 60 Q 35 52, 40 48 L 45 40 Q 50 30, 55 25 L 60 15 Q 63 8, 65 5 L 68 10 Q 70 15, 72 18 L 75 25 Q 78 35, 80 40 L 85 50 Q 88 58, 90 62 L 95 70 Q 98 78, 100 85 L 100 100 L 0 100 Z"
          fill="#4A6B54"
          opacity="0.9"
        />

        <path
          d="M 58 15 Q 60 10, 62 8 L 64 5 L 66 8 Q 68 12, 70 15 L 58 15 Z"
          fill="#FDFBF7"
          opacity="0.95"
        />

        {showTrail && (
          <path
            d={trailPath}
            fill="none"
            stroke="#FDFBF7"
            strokeWidth="0.3"
            strokeDasharray="1,1"
            opacity="0.6"
          />
        )}

        {[25, 50, 75, 100].map((milestone) => {
          const pos = getPositionOnTrail(milestone);
          return (
            <g key={milestone}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r="0.8"
                fill="#FDFBF7"
                opacity="0.4"
              />
            </g>
          );
        })}
      </svg>

      <motion.div
        className="absolute"
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          transform: 'translate(-50%, -50%)',
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
        <ClimberAvatar
          name={climberName}
          size={48}
          color={climberColor}
        />
      </motion.div>
    </div>
  );
}
