import { ClimberAvatar } from "./ClimberAvatar";

interface MiniMountainProps {
  progress: number;
  climberName?: string;
}

export function MiniMountain({ progress, climberName = "" }: MiniMountainProps) {
  const climberY = 95 - (progress * 0.85);

  return (
    <div className="relative w-20 h-24">
      <svg
        viewBox="0 0 80 100"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={`miniSky-${climberName}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F4D8BA" />
            <stop offset="100%" stopColor="#FBF2E4" />
          </linearGradient>
        </defs>

        <rect width="80" height="100" fill={`url(#miniSky-${climberName})`} />

        <path
          d="M 0 85 Q 15 70, 25 65 L 30 55 Q 35 45, 40 40 L 45 30 Q 50 20, 55 15 L 60 25 Q 65 35, 70 45 L 75 60 Q 78 70, 80 85 L 80 100 L 0 100 Z"
          fill="#4A6B54"
          opacity="0.9"
        />

        <path
          d="M 45 30 Q 50 20, 55 15 L 60 25 L 45 30 Z"
          fill="#FDFBF7"
          opacity="0.95"
        />
      </svg>

      {progress > 0 && (
        <div
          className="absolute"
          style={{
            left: '50%',
            top: `${climberY}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <ClimberAvatar name={climberName || "F"} size={24} color="#D99A8F" />
        </div>
      )}
    </div>
  );
}
