import { useState, useEffect } from "react";

// Dark cat with purple edge-lighting for visibility
export const CAT_COLORS: Record<string, string> = {
  b: "#2A1E2A", // dark body
  e: "#6A4A7A", // edge outline (purple tint)
  y: "#E8C840", // amber eye
  Y: "#F0D860", // bright eye center
  w: "#FFFFFF", // white eye shine
  h: "#7B5EA7", // harness purple
  r: "#C8A050", // rope gold
  g: "#6B6060", // boot gray
  p: "#7A4A6A", // inner ear pink
  m: "#E8B0C0", // nose pink
  t: "#4A3050", // tail
  ".": "",
};

// 16x16 sprite — 3/4 view head (both eyes!) + side body
// Big head, pointy ears, narrow neck, compact body, curving tail
// This reads as CAT from the silhouette alone

export const WALK1 = [
  "....ee.ee.......",
  "...ebbe.ebbe....",
  "...ebpe.epbe....",
  "..ebbbbbbbbbe...",
  ".ebbbbbbbbbbe...",
  ".ebyYbbbYybbe...",
  ".ebywbbbwybbe...",
  ".ebbbbmbbbbbe...",
  "..ebbbbbbbbe....",
  "...ebhhhbbe.....",
  "..ebbbbbbbbe....",
  "..ebbbbbbbbet...",
  "...ebe..ebe.t...",
  "...ege..ege..t..",
  "....ge..eg......",
  "................",
];

export const WALK2 = [
  "....ee.ee.......",
  "...ebbe.ebbe....",
  "...ebpe.epbe....",
  "..ebbbbbbbbbe...",
  ".ebbbbbbbbbbe...",
  ".ebyYbbbYybbe...",
  ".ebywbbbwybbe...",
  ".ebbbbmbbbbbe...",
  "..ebbbbbbbbe....",
  "...ebhhhbbe.....",
  "..ebbbbbbbbe....",
  "..ebbbbbbbbet...",
  "..ebe....ebe.t..",
  "..ege....ege..t.",
  "...ge....eg.....",
  "................",
];

export const IDLE = [
  "....ee.ee.......",
  "...ebbe.ebbe....",
  "...ebpe.epbe....",
  "..ebbbbbbbbbe...",
  ".ebbbbbbbbbbe...",
  ".ebbwbbbwbbbe...",
  ".ebbbbbbbbbbe...",
  ".ebbbbmbbbbbe...",
  "..ebbbbbbbbe....",
  "...ebhhhbbe.....",
  "..ebbbbbbbbe....",
  "..ebbbbbbbbett..",
  "....ebe.ebe.t...",
  "....ege.ege.....",
  ".....ge.eg......",
  "................",
];

interface PixelCatProps {
  size?: number;
  isWalking?: boolean;
  flipX?: boolean;
}

export function PixelCat({ size = 64, isWalking = true, flipX = false }: PixelCatProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!isWalking) return;
    const interval = setInterval(() => setFrame((f) => (f + 1) % 2), 280);
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
            const color = CAT_COLORS[char];
            if (!color) return null;
            return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />;
          })
        )}
      </svg>
    </div>
  );
}
