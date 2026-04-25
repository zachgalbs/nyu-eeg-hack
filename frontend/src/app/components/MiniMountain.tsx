import { PixelCat } from "./PixelCat";

interface MiniMountainProps {
  progress: number;
  climberName?: string;
}

const MINI_STEPS: [number, number][] = [
  [0, 92], [4, 89], [8, 85], [12, 81], [16, 76],
  [20, 71], [24, 66], [28, 60], [32, 54], [36, 48],
  [40, 42], [44, 36], [48, 30], [52, 25], [56, 20],
  [60, 16], [64, 12], [68, 9], [72, 6], [76, 4],
];

function seeded(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Build terrain polygon
function buildMiniTerrainPath(steps: [number, number][]): string {
  let d = `M ${steps[0][0]} ${steps[0][1]}`;
  for (let i = 1; i < steps.length; i++) {
    d += ` L ${steps[i][0]} ${steps[i][1]}`;
  }
  d += ` L 80 ${steps[steps.length - 1][1]} L 80 100 L 0 100 Z`;
  return d;
}

export function MiniMountain({ progress, climberName: _climberName = "" }: MiniMountainProps) {
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
        {/* Dark sky */}
        <defs>
          <linearGradient id="miniDarkSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1A2535" />
            <stop offset="100%" stopColor="#2E3D4D" />
          </linearGradient>
          <linearGradient id="miniRockGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4A3A5A" />
            <stop offset="50%" stopColor="#3A2A4A" />
            <stop offset="100%" stopColor="#4A3A5A" />
          </linearGradient>
        </defs>
        <rect width="80" height="100" fill="url(#miniDarkSky)" />

        {/* Stars */}
        {[
          { x: 5, y: 8 }, { x: 20, y: 15 }, { x: 35, y: 5 },
          { x: 50, y: 12 }, { x: 65, y: 7 },
        ].map((s, i) => (
          <rect key={`mstar-${i}`} x={s.x} y={s.y} width={0.8} height={0.8} fill="#C8D8E8" opacity={0.3 + seeded(i * 43) * 0.3} />
        ))}

        {/* Back mountain hint — smoother */}
        <path
          d="M 0 70 Q 8 58 15 52 Q 20 48 25 50 Q 32 38 40 30 L 80 30 L 80 100 L 0 100 Z"
          fill="#222D3A"
          opacity="0.35"
        />

        {/* Rock terrain — solid polygon */}
        <path d={buildMiniTerrainPath(MINI_STEPS)} fill="url(#miniRockGrad)" />

        {/* Snow patches on upper mountain */}
        {MINI_STEPS.map(([x, groundY], i) => {
          const ratio = i / MINI_STEPS.length;
          if (ratio < 0.35) return null;
          const nextX = i < MINI_STEPS.length - 1 ? MINI_STEPS[i + 1][0] : x + 4;
          const seed = seeded(i * 37 + 7);
          if (seed < 0.3 && ratio < 0.65) return null;
          const depth = ratio > 0.7 ? 2 + seed * 2 : 1 + seed;
          return (
            <rect
              key={`msnow-${i}`}
              x={x}
              y={groundY}
              width={nextX - x + 0.5}
              height={depth}
              fill={seed > 0.5 ? "#EEEEF0" : "#D8DCE8"}
            />
          );
        })}

        {/* Peak snow */}
        <rect x={68} y={4} width={12} height={5} fill="#EEEEF0" />
        <rect x={72} y={2} width={8} height={4} fill="#FFFFFF" opacity="0.8" />

        {/* Mini flag */}
        <rect x={75} y={-1} width={1} height={6} fill="#6A5A4A" />
        <rect x={76} y={-1} width={3} height={1} fill="#E07050" />
        <rect x={76} y={0} width={2} height={1} fill="#D06040" />

        {/* Rain streaks */}
        {[12, 28, 45, 60, 20, 50, 70].map((x, i) => (
          <line
            key={i}
            x1={x}
            y1={i * 12}
            x2={x - 2}
            y2={i * 12 + 8}
            stroke="#7A9AB8"
            strokeWidth="0.3"
            opacity="0.12"
          />
        ))}

        {/* Snowflakes — pixel squares */}
        {[
          { cx: 10, delay: 0, dur: 3.5 },
          { cx: 30, delay: 1.5, dur: 4.5 },
          { cx: 50, delay: 0.8, dur: 4 },
          { cx: 65, delay: 2.2, dur: 3.5 },
        ].map((f, i) => (
          <rect key={`mflake-${i}`} width={0.8} height={0.8} fill="#E8ECF4" opacity="0.4">
            <animate attributeName="y" values="-2;102" dur={`${f.dur}s`} begin={`${f.delay}s`} repeatCount="indefinite" />
            <animate attributeName="x" values={`${f.cx};${f.cx + 2}`} dur={`${f.dur}s`} begin={`${f.delay}s`} repeatCount="indefinite" />
          </rect>
        ))}

        {/* Tiny pixel trees */}
        {[
          { x: 6, y: 88 },
          { x: 24, y: 62 },
          { x: 44, y: 35 },
        ].map((tree, i) => (
          <g key={`mtree-${i}`}>
            <rect x={tree.x + 1} y={tree.y} width={1} height={2} fill="#3A2A18" />
            <rect x={tree.x} y={tree.y - 2} width={3} height={2} fill="#1A3828" />
            <rect x={tree.x + 1} y={tree.y - 3} width={1} height={1} fill="#E8ECF0" />
          </g>
        ))}
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
          <PixelCat size={24} isWalking={progress < 100} />
        </div>
      )}
    </div>
  );
}
