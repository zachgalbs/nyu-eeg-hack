import { useState, useEffect } from "react";
import { CAT_COLORS, WALK1, WALK2, IDLE } from "./PixelCat";

interface MountainSVGProps {
  progress: number;
  climberName?: string;
  climberColor?: string;
  showTrail?: boolean;
  trailOnly?: boolean;
  isPaused?: boolean;
  friendClimbers?: Array<{ id: string; name: string; progress: number; color?: string }>;
  throwProjectile?: {
    fromProgress: number;
    toProgress: number;
    active: boolean;
  } | null;
}

const PX = 2;

function seeded(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Terrain steps — upward slope, bottom-left to peak top-right
const TERRAIN_STEPS: [number, number][] = [
  [0, 95], [2, 95], [4, 94], [6, 93], [8, 92], [10, 91],
  [12, 90], [14, 88], [16, 86], [18, 84], [20, 82], [22, 80],
  [24, 78], [26, 76], [28, 74], [30, 72], [32, 70], [34, 68],
  [36, 66], [38, 64], [40, 62], [42, 60], [44, 58], [46, 55],
  [48, 52], [50, 50], [52, 48], [54, 45], [56, 42], [58, 40],
  [60, 38], [62, 36], [64, 34], [66, 32], [68, 30], [70, 28],
  [72, 26], [74, 24], [76, 22], [78, 20], [80, 18], [82, 16],
  [84, 14], [86, 13], [88, 12], [90, 11], [92, 10], [94, 10],
  [96, 10], [98, 10],
];

// Compute cat position ON the terrain surface with slope angle
export function getTerrainPosition(progress: number) {
  const p = Math.max(0, Math.min(100, progress));
  const startX = 4;
  const endX = 92;
  const catX = startX + (p / 100) * (endX - startX);

  for (let i = 0; i < TERRAIN_STEPS.length - 1; i++) {
    const [x0, y0] = TERRAIN_STEPS[i];
    const [x1, y1] = TERRAIN_STEPS[i + 1];
    if (catX >= x0 && catX <= x1) {
      const t = (catX - x0) / (x1 - x0);
      const terrainY = y0 + (y1 - y0) * t;
      const slopeAngle = Math.atan2(y1 - y0, x1 - x0) * (180 / Math.PI);
      return { x: catX, y: terrainY, angle: slopeAngle };
    }
  }
  const last = TERRAIN_STEPS[TERRAIN_STEPS.length - 1];
  return { x: catX, y: last[1], angle: 0 };
}

// Trees
const TREES: { x: number; baseY: number; size: "s" | "m" }[] = [
  { x: 8, baseY: 90, size: "m" },
  { x: 20, baseY: 80, size: "s" },
  { x: 34, baseY: 67, size: "m" },
  { x: 46, baseY: 55, size: "s" },
  { x: 58, baseY: 40, size: "s" },
  { x: 70, baseY: 28, size: "s" },
];

// Rocks
const ROCKS: { x: number; y: number }[] = [
  { x: 14, y: 87 }, { x: 26, y: 75 }, { x: 40, y: 62 },
  { x: 52, y: 49 }, { x: 64, y: 34 }, { x: 76, y: 22 },
];

// Rain
const RAIN = Array.from({ length: 24 }, (_, i) => ({
  x: seeded(i * 7 + 100) * 110 - 5,
  y: seeded(i * 11 + 200) * 110 - 10,
  len: 3 + seeded(i * 13 + 300) * 6,
  opacity: 0.06 + seeded(i * 17 + 400) * 0.1,
}));

// Snowflakes
const SNOWFLAKES = Array.from({ length: 18 }, (_, i) => ({
  x: seeded(i * 7 + 1) * 100,
  delay: seeded(i * 13 + 2) * 6,
  dur: 5 + seeded(i * 17 + 3) * 6,
  size: 0.3 + seeded(i * 23 + 4) * 0.6,
  drift: (seeded(i * 31 + 5) - 0.5) * 6,
}));

function buildTerrainPath(steps: [number, number][]): string {
  let d = `M ${steps[0][0]} ${steps[0][1]}`;
  for (let i = 1; i < steps.length; i++) d += ` L ${steps[i][0]} ${steps[i][1]}`;
  d += ` L 100 ${steps[steps.length - 1][1]} L 100 100 L 0 100 Z`;
  return d;
}

function SnowTree({ x, baseY, size }: { x: number; baseY: number; size: "s" | "m" }) {
  const cx = x + 2;
  const rects: { rx: number; ry: number; c: string }[] = [];
  rects.push({ rx: cx, ry: baseY, c: "#3A2A18" });
  rects.push({ rx: cx, ry: baseY - 1, c: "#3A2A18" });
  if (size === "m") rects.push({ rx: cx, ry: baseY - 2, c: "#3A2A18" });
  const foliageStart = baseY - 2 - (size === "m" ? 1 : 0);
  const layers = size === "m" ? 5 : 4;
  for (let i = 0; i < layers; i++) {
    const y = foliageStart - i;
    const hw = Math.floor((layers - i) / 2);
    for (let dx = -hw; dx <= hw; dx++) {
      rects.push({
        rx: cx + dx, ry: y,
        c: i >= layers - 2 ? "#E8ECF0" : Math.abs(dx) === hw ? "#2A4A38" : "#1A3828",
      });
    }
    if (i === layers - 1) rects.push({ rx: cx, ry: y - 1, c: "#E8ECF0" });
  }
  return <g>{rects.map((r, i) => <rect key={i} x={r.rx} y={r.ry} width={1} height={1} fill={r.c} />)}</g>;
}

function DarkRock({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={3} height={2} fill="#4A3A30" />
      <rect x={x + 1} y={y - 1} width={2} height={1} fill="#5A4A3A" />
      <rect x={x + 2} y={y - 2} width={1} height={1} fill="#6A5A4A" />
      <rect x={x + 1} y={y - 2} width={2} height={0.5} fill="#DDDDE0" opacity="0.5" />
    </g>
  );
}

// Inline SVG cat that follows terrain slope
function TerrainCat({ progress, isPaused = false }: { progress: number; isPaused?: boolean }) {
  const [frame, setFrame] = useState(0);
  const isWalking = progress < 100 && !isPaused;

  useEffect(() => {
    if (!isWalking) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % 2), 280);
    return () => clearInterval(id);
  }, [isWalking]);

  const sprite = isWalking ? (frame === 0 ? WALK1 : WALK2) : IDLE;
  const pos = getTerrainPosition(progress);
  const cols = sprite[0].length;
  const rows = sprite.length;
  const scale = 0.82;

  return (
    <g transform={`translate(${pos.x}, ${pos.y}) rotate(${pos.angle})`}>
      {/* Bobbing motion perpendicular to slope */}
      <g>
        {!isPaused && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 0,-0.5; 0,0"
            dur="0.55s"
            repeatCount="indefinite"
          />
        )}
        <ellipse cx={0} cy={0.6} rx={2.2} ry={0.55} fill="#0D1218" opacity="0.4" />
        {/* Scale and center — feet at origin */}
        <g transform={`scale(${scale}) translate(${-cols / 2}, ${-rows})`}>
          {sprite.map((row, ry) =>
            row.split("").map((char, rx) => {
              const color = CAT_COLORS[char];
              if (!color) return null;
              return <rect key={`c${rx}-${ry}`} x={rx} y={ry} width={1} height={1} fill={color} />;
            })
          )}
        </g>
      </g>
    </g>
  );
}

export function MountainSVG({
  progress,
  showTrail = true,
  isPaused = false,
  friendClimbers = [],
  throwProjectile = null,
}: MountainSVGProps) {
  const projectileFrom = throwProjectile ? getTerrainPosition(throwProjectile.fromProgress) : null;
  const projectileTo = throwProjectile ? getTerrainPosition(throwProjectile.toProgress) : null;

  return (
    <div className="relative w-full h-full">
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid slice"
        shapeRendering="crispEdges"
      >
        <defs>
          <linearGradient id="darkSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#101820" />
            <stop offset="40%" stopColor="#1A2535" />
            <stop offset="80%" stopColor="#253545" />
            <stop offset="100%" stopColor="#2E3D4D" />
          </linearGradient>
          <linearGradient id="rockGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4A3A5A" />
            <stop offset="40%" stopColor="#3A2A4A" />
            <stop offset="70%" stopColor="#4A3A5A" />
            <stop offset="100%" stopColor="#3A2A4A" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill="url(#darkSky)" />

        {/* Stars */}
        {[
          { x: 8, y: 3, s: 0.6 }, { x: 22, y: 8, s: 0.4 }, { x: 35, y: 2, s: 0.5 },
          { x: 48, y: 5, s: 0.3 }, { x: 62, y: 3, s: 0.5 }, { x: 75, y: 7, s: 0.4 },
          { x: 88, y: 2, s: 0.6 }, { x: 15, y: 14, s: 0.3 }, { x: 42, y: 11, s: 0.4 },
          { x: 58, y: 16, s: 0.3 }, { x: 5, y: 20, s: 0.4 }, { x: 30, y: 18, s: 0.3 },
          { x: 70, y: 12, s: 0.5 }, { x: 95, y: 6, s: 0.3 }, { x: 50, y: 1, s: 0.5 },
          { x: 18, y: 22, s: 0.4 }, { x: 82, y: 15, s: 0.3 }, { x: 40, y: 20, s: 0.4 },
        ].map((star, i) => (
          <rect key={`star-${i}`} x={star.x} y={star.y} width={star.s} height={star.s} fill="#C8D8E8" opacity={0.3 + seeded(i * 43 + 99) * 0.4}>
            <animate attributeName="opacity" values={`${0.2 + seeded(i * 43) * 0.3};${0.5 + seeded(i * 43) * 0.3};${0.2 + seeded(i * 43) * 0.3}`} dur={`${3 + seeded(i * 31) * 4}s`} repeatCount="indefinite" />
          </rect>
        ))}

        {/* Clouds */}
        <ellipse cx="30" cy="10" rx="10" ry="2" fill="#3A4A5A" opacity="0.2" />
        <ellipse cx="65" cy="5" rx="8" ry="1.5" fill="#3A4A5A" opacity="0.15" />

        {/* Distant mountains */}
        <path d="M -5 70 Q 5 55 10 58 Q 14 45 20 35 Q 24 30 28 33 Q 35 22 42 15 Q 46 12 50 14 L 100 14 L 100 100 L -5 100 Z" fill="#1A2535" opacity="0.45" />
        <path d="M 20 35 Q 24 30 28 33 L 28 38 L 22 35 Z" fill="#EEEEF0" opacity="0.12" />
        <path d="M 42 15 Q 46 12 50 14 L 50 18 L 44 16 Z" fill="#EEEEF0" opacity="0.12" />
        <path d="M -5 78 Q 5 65 12 60 Q 18 52 24 54 Q 32 40 40 32 Q 46 28 52 25 Q 58 22 65 20 L 100 20 L 100 100 L -5 100 Z" fill="#1E2838" opacity="0.4" />

        {/* Main terrain */}
        <path d={buildTerrainPath(TERRAIN_STEPS)} fill="url(#rockGrad)" />

        {/* Rock texture */}
        {TERRAIN_STEPS.filter((_, i) => i % 3 === 0 && i > 4).map(([x, groundY], i) => {
          const s = seeded(i * 19 + 50);
          return (
            <line key={`ledge-${i}`} x1={x} y1={groundY + 4 + s * 6} x2={x + 4 + s * 8} y2={groundY + 3 + s * 6} stroke="#2A1A3A" strokeWidth="0.6" opacity="0.35" />
          );
        })}

        {/* Shadow patches */}
        {[
          { x: 16, y: 86, w: 5, h: 6 }, { x: 30, y: 72, w: 5, h: 5 },
          { x: 44, y: 58, w: 4, h: 5 }, { x: 56, y: 42, w: 5, h: 5 },
          { x: 68, y: 30, w: 4, h: 4 }, { x: 80, y: 18, w: 5, h: 3 },
        ].map((p, i) => (
          <rect key={`shade-${i}`} x={p.x} y={p.y} width={p.w} height={p.h} fill="#2A1A3A" opacity="0.2" />
        ))}

        {/* Snow patches */}
        {TERRAIN_STEPS.map(([x, groundY], i) => {
          const ratio = i / TERRAIN_STEPS.length;
          if (ratio < 0.35) return null;
          const nextX = i < TERRAIN_STEPS.length - 1 ? TERRAIN_STEPS[i + 1][0] : x + 2;
          const s = seeded(i * 37 + 7);
          if (s < 0.25 && ratio < 0.7) return null;
          const depth = ratio > 0.75 ? 3 + s * 2 : 1 + s * 2;
          return (
            <g key={`snow-${i}`}>
              <rect x={x} y={groundY} width={nextX - x + 0.5} height={depth} fill={s > 0.5 ? "#EEEEF0" : "#D8DCE8"} />
              {ratio > 0.6 && <rect x={x + 0.5} y={groundY} width={nextX - x - 0.5} height={0.5} fill="#FFFFFF" opacity="0.7" />}
            </g>
          );
        })}

        {/* Ground */}
        <rect x={0} y={95} width={100} height={5} fill="#1A1515" />
        <rect x={3} y={95} width={PX} height={1} fill="#4A3A30" />
        <rect x={8} y={96} width={PX} height={1} fill="#3A2A20" />

        {/* Peak snow */}
        <rect x={84} y={8} width={16} height={4} fill="#EEEEF0" />
        <rect x={88} y={6} width={12} height={3} fill="#FFFFFF" opacity="0.95" />
        <rect x={82} y={11} width={18} height={3} fill="#D8DCE8" opacity="0.5" />

        {/* Flag */}
        <rect x={93} y={2} width={1} height={9} fill="#6A5A4A" />
        <rect x={94} y={2} width={3} height={1} fill="#E07050" />
        <rect x={94} y={3} width={3} height={1} fill="#D06040" />
        <rect x={94} y={4} width={2} height={1} fill="#C05030" />
        <rect x={94} y={5} width={1} height={1} fill="#B04020" />

        {/* Trees */}
        {TREES.map((tree, i) => <SnowTree key={i} {...tree} />)}

        {/* Rocks */}
        {ROCKS.map((rock, i) => <DarkRock key={i} {...rock} />)}

        {/* Trail footprints */}
        {showTrail && TERRAIN_STEPS.filter((_, i) => i % 3 === 0 && i > 1 && i < TERRAIN_STEPS.length - 5).map(([x, y], i) => (
          <g key={`trail-${i}`} opacity={0.2}>
            <rect x={x + 1} y={y + 1} width={1} height={1} fill="#8AA0B8" />
            <rect x={x + 3} y={y + 1.5} width={1} height={1} fill="#8AA0B8" />
          </g>
        ))}

        {/* Rain */}
        {RAIN.map((r, i) => (
          <line key={`rain-${i}`} x1={r.x} y1={r.y} x2={r.x - r.len * 0.3} y2={r.y + r.len} stroke="#7A9AB8" strokeWidth="0.25" opacity={r.opacity * 0.9} />
        ))}

        {/* Snowflakes */}
        {SNOWFLAKES.map((f, i) => (
          <rect key={`flake-${i}`} width={f.size < 0.5 ? 0.5 : 0.8} height={f.size < 0.5 ? 0.5 : 0.8} fill="#E8ECF4" opacity={0.35 + seeded(i * 7) * 0.3}>
            <animate attributeName="y" values="-2;102" dur={`${f.dur}s`} begin={`${f.delay}s`} repeatCount="indefinite" />
            <animate attributeName="x" values={`${f.x};${f.x + f.drift}`} dur={`${f.dur}s`} begin={`${f.delay}s`} repeatCount="indefinite" />
          </rect>
        ))}

        {friendClimbers.map((friend) => {
          const marker = getTerrainPosition(friend.progress);
          return (
            <g key={friend.id} transform={`translate(${marker.x}, ${marker.y - 1.4})`}>
              <circle r={1.5} fill={friend.color || "#7fb3d8"} opacity="0.95" />
              <circle r={0.6} cy={-0.3} fill="#f1f5f9" opacity="0.9" />
              <text
                x={2}
                y={-1}
                fill="#d9e6f2"
                style={{ fontSize: "2.2px", fontFamily: "var(--font-mono)" }}
              >
                {friend.name.slice(0, 1).toUpperCase()}
              </text>
            </g>
          );
        })}

        {throwProjectile?.active && projectileFrom && projectileTo ? (
          <g>
            <circle r={0.95} fill="#ffb36a" opacity="0.95">
              <animateMotion
                dur="650ms"
                repeatCount="1"
                fill="freeze"
                path={`M ${projectileFrom.x} ${projectileFrom.y - 1.6} L ${projectileTo.x} ${projectileTo.y - 1.6}`}
              />
              <animate attributeName="r" values="0.8;1.1;0.8" dur="650ms" repeatCount="1" />
            </circle>
          </g>
        ) : null}

        {/* Cat — rendered inline in SVG, follows terrain slope */}
        <TerrainCat progress={progress} isPaused={isPaused} />
      </svg>
    </div>
  );
}
