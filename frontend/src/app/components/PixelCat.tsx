import { useState, useEffect } from "react";

// Color palette matching the app's warm theme
const C: Record<string, string> = {
  o: "#E8944A", // orange fur
  l: "#F4A460", // light orange
  d: "#C67030", // dark stripe
  k: "#2D2D2D", // black
  w: "#FFFFFF", // white
  p: "#FFB6C1", // pink
  ".": "",
};

// 14x13 pixel cat sprite, side view facing right
// Walking frame 1 (compact stride)
const WALK1 = [
  "..oo......oo..",
  ".olpo....olpo.",
  ".oooooooooooo.",
  ".owkoooooowko.",
  ".oooooooooooo.",
  "..oooopoooo...",
  "...oooooooo...",
  "..oooooooooo..",
  ".ooddooooddoo.",
  ".oooooooooooo.",
  ".ooooooooooo.t",
  "..oo....oo..tt",
  "..oo....oo...t",
];

// Walking frame 2 (wide stride)
const WALK2 = [
  "..oo......oo..",
  ".olpo....olpo.",
  ".oooooooooooo.",
  ".owkoooooowko.",
  ".oooooooooooo.",
  "..oooopoooo...",
  "...oooooooo...",
  "..oooooooooo..",
  ".ooddooooddoo.",
  ".oooooooooooo.",
  ".ooooooooooo.t",
  ".oo......oo.tt",
  "..o.......o..t",
];

// Idle frame (sitting, tail curled)
const IDLE = [
  "..oo......oo..",
  ".olpo....olpo.",
  ".oooooooooooo.",
  ".owkoooooowko.",
  ".oooooooooooo.",
  "..oooopoooo...",
  "...oooooooo...",
  "..oooooooooo..",
  ".ooddooooddoo.",
  ".oooooooooooo.",
  ".ooooooooooo.t",
  "...oo..oo..ttt",
  "...oo..oo.....",
];

interface PixelCatProps {
  size?: number;
  isWalking?: boolean;
  flipX?: boolean;
}

export function PixelCat({ size = 48, isWalking = true, flipX = false }: PixelCatProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!isWalking) return;
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % 2);
    }, 300);
    return () => clearInterval(interval);
  }, [isWalking]);

  const sprite = isWalking ? (frame === 0 ? WALK1 : WALK2) : IDLE;
  const cols = sprite[0].length;
  const rows = sprite.length;
  const pixelSize = size / Math.max(cols, rows);

  return (
    <div
      style={{
        width: cols * pixelSize,
        height: rows * pixelSize,
        transform: flipX ? "scaleX(-1)" : undefined,
        imageRendering: "pixelated",
      }}
    >
      <svg
        width={cols * pixelSize}
        height={rows * pixelSize}
        viewBox={`0 0 ${cols} ${rows}`}
        shapeRendering="crispEdges"
      >
        {sprite.map((row, y) =>
          row.split("").map((char, x) => {
            const color = C[char];
            if (!color) return null;
            return (
              <rect
                key={`${x}-${y}`}
                x={x}
                y={y}
                width={1}
                height={1}
                fill={color}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}
