import { PixelCat } from "./PixelCat";

interface MiniMountainProps {
  progress: number;
  climberName?: string;
}

const PX = 3;

// Mini terrain steps — upward slope only
const MINI_STEPS: [number, number][] = [
  [0, 90], [6, 87], [12, 82], [18, 76], [24, 69],
  [30, 61], [36, 52], [42, 42], [48, 33], [54, 24],
  [60, 17], [66, 11], [72, 6], [78, 3],
];

export function MiniMountain({ progress, climberName: _climberName = "" }: MiniMountainProps) {
  // Position cat along the slope based on progress
  const p = Math.max(0, Math.min(100, progress));
  const idx = (p / 100) * (MINI_STEPS.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const t = idx - lo;
  const loStep = MINI_STEPS[lo];
  const hiStep = MINI_STEPS[hi];
  const catX = loStep[0] + (hiStep[0] - loStep[0]) * t;
  const catY = loStep[1] + (hiStep[1] - loStep[1]) * t;

  return (
    <div className="relative w-20 h-24">
      <svg
        viewBox="0 0 80 100"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        shapeRendering="crispEdges"
      >
        <defs>
          <linearGradient id={`miniPixelSky`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F4D8BA" />
            <stop offset="100%" stopColor="#FBF2E4" />
          </linearGradient>
        </defs>

        <rect width="80" height="100" fill={`url(#miniPixelSky)`} />

        {/* Pixel terrain — upward slope only */}
        {MINI_STEPS.map(([x, groundY], i) => {
          const nextX = i < MINI_STEPS.length - 1 ? MINI_STEPS[i + 1][0] : x + 6;
          const shade = i % 3 === 0 ? "#3D5A46" : i % 3 === 1 ? "#4A6B54" : "#567A5E";
          return (
            <rect
              key={i}
              x={x}
              y={groundY}
              width={nextX - x + 0.5}
              height={100 - groundY + 1}
              fill={shade}
            />
          );
        })}

        {/* Grass highlights */}
        {MINI_STEPS.map(([x, groundY], i) => (
          <rect
            key={`g-${i}`}
            x={x}
            y={groundY}
            width={6}
            height={1.5}
            fill={i % 2 === 0 ? "#6B8E5A" : "#7BA06A"}
          />
        ))}

        {/* Snow cap */}
        <rect x={66} y={6} width={PX * 3} height={PX} fill="#FDFBF7" opacity="0.9" />
        <rect x={72} y={3} width={PX * 2} height={PX} fill="#FDFBF7" opacity="0.8" />

        {/* Small pixel flag */}
        <rect x={74} y={0} width={1} height={5} fill="#8B6914" />
        <rect x={75} y={0} width={PX} height={2} fill="#C66B52" />
      </svg>

      {/* Mini pixel cat */}
      {progress > 0 && (
        <div
          className="absolute"
          style={{
            left: `${(catX / 80) * 100}%`,
            top: `${(catY / 100) * 100}%`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <PixelCat size={22} isWalking={progress < 100} />
        </div>
      )}
    </div>
  );
}
