import { CLIMBER_CAT_SRC } from "../../lib/theme-asset";

interface ClimberAvatarProps {
  name: string;
  size?: number;
  color?: string;
  isActive?: boolean;
  /** Pixel cat sprite on the mountain trail instead of an initial circle. */
  variant?: "initial" | "pixelCat";
}

export function ClimberAvatar({
  name,
  size = 32,
  color = "#C66B52",
  isActive = false,
  variant = "initial",
}: ClimberAvatarProps) {
  const initial = name.charAt(0).toUpperCase();

  if (variant === "pixelCat") {
    const w = Math.round(size * 1.45);
    const h = Math.round(size * 1.15);
    return (
      <div
        className="relative flex select-none items-center justify-center"
        style={{
          width: w,
          height: h,
          filter: isActive ? `drop-shadow(0 0 6px ${color})` : undefined,
        }}
        title={name}
      >
        <img
          src={CLIMBER_CAT_SRC}
          alt={name}
          width={w}
          height={h}
          className="max-h-full max-w-full object-contain"
          style={{
            imageRendering: "pixelated",
          }}
          draggable={false}
        />
        <span
          className="pointer-events-none absolute rounded-full border-2"
          style={{
            inset: -2,
            borderColor: color,
            opacity: 0.85,
          }}
          aria-hidden
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
