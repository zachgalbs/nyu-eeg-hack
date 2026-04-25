import { useEffect, useState } from "react";
import { CLIMBER_CAT_SRC, CLIMBER_CAT_WALK_FRAMES } from "../../lib/theme-asset";

interface ClimberAvatarProps {
  name: string;
  size?: number;
  color?: string;
  isActive?: boolean;
  /** Pixel cat sprite on the mountain trail instead of an initial circle. */
  variant?: "initial" | "pixelCat" | "pixelCatWalk";
  isMoving?: boolean;
  frameDurationMs?: number;
}

export function ClimberAvatar({
  name,
  size = 32,
  color = "#C66B52",
  isActive = false,
  variant = "initial",
  isMoving = false,
  frameDurationMs = 120,
}: ClimberAvatarProps) {
  const initial = name.charAt(0).toUpperCase();
  const [walkFrame, setWalkFrame] = useState(0);

  useEffect(() => {
    if (variant !== "pixelCatWalk" || !isMoving) {
      setWalkFrame(0);
      return;
    }
    const id = window.setInterval(() => {
      setWalkFrame((prev) => (prev + 1) % CLIMBER_CAT_WALK_FRAMES.length);
    }, frameDurationMs);
    return () => window.clearInterval(id);
  }, [variant, isMoving, frameDurationMs]);

  if (variant === "pixelCat" || variant === "pixelCatWalk") {
    const w = Math.round(size * 1.5);
    const h = Math.round(size * 1.2);
    const src =
      variant === "pixelCatWalk" ? CLIMBER_CAT_WALK_FRAMES[walkFrame] : CLIMBER_CAT_SRC;
    return (
      <div
        className="relative flex select-none items-center justify-center"
        style={{
          width: w,
          height: h,
          filter: isActive ? `drop-shadow(0 0 3px ${color})` : undefined,
        }}
        title={name}
      >
        <img
          src={src}
          alt={name}
          width={w}
          height={h}
          className="max-h-full max-w-full object-contain"
          style={{
            imageRendering: "pixelated",
            transform: "translateZ(0)",
            filter: "contrast(1.08) saturate(1.04)",
          }}
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center bg-snow font-semibold"
      style={{
        width: size,
        height: size,
        borderRadius: "999px",
        border: `2px solid ${color}`,
        fontSize: size * 0.4,
        fontFamily: "var(--font-sans)",
        color: color,
        boxShadow: isActive ? `0 0 0 2px ${color}40` : "none",
      }}
    >
      {initial}
    </div>
  );
}
