interface ClimberAvatarProps {
  name: string;
  size?: number;
  color?: string;
  isActive?: boolean;
}

export function ClimberAvatar({
  name,
  size = 32,
  color = "#C66B52",
  isActive = false,
}: ClimberAvatarProps) {
  const initial = name.charAt(0).toUpperCase();

  return (
    <div
      className="flex items-center justify-center bg-snow font-semibold"
      style={{
        width: size,
        height: size,
        borderRadius: '999px',
        border: `2px solid ${color}`,
        fontSize: size * 0.4,
        fontFamily: 'var(--font-sans)',
        color: color,
        boxShadow: isActive ? `0 0 0 2px ${color}40` : 'none',
      }}
    >
      {initial}
    </div>
  );
}
