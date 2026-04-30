import { useEffect, useRef } from "react";
import { Music, VolumeX, Volume2, X } from "lucide-react";
import { FOCUS_TRACKS, useFocusAudio, type FocusTrackId } from "../../lib/use-focus-audio";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function MusicPicker({ open, onClose }: Props) {
  const { trackId, isMuted, isPlaying, volume, play, pause, toggleMute, setTrack, setVolume } = useFocusAudio();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handlePick = (id: FocusTrackId) => {
    setTrack(id);
    if (!isPlaying) play();
  };

  const togglePlay = () => {
    if (isPlaying) pause();
    else play();
  };

  return (
    <div className="absolute inset-0 z-30 flex items-end" role="dialog" aria-modal="true" aria-label="Focus sounds">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
        aria-label="Close focus sounds"
      />
      <div
        ref={sheetRef}
        className="relative z-10 w-full rounded-t-2xl border border-border border-b-0 bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-card)] sm:px-6"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="h-4 w-4 text-foreground" strokeWidth={2} />
            <p className="text-sm font-semibold text-foreground">Focus sound</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border bg-background-solid/60 p-1.5 text-warm-gray transition-opacity hover:opacity-80"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="mb-3 grid grid-cols-2 gap-2">
          {FOCUS_TRACKS.map((t) => {
            const active = t.id === trackId;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => handlePick(t.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border bg-background-solid/45 text-foreground hover:border-primary/50"
                  }`}
                  aria-pressed={active}
                >
                  <p className="text-[14px] font-semibold">{t.label}</p>
                  <p className="text-[11px] text-warm-gray">{t.hint}</p>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="rounded-full border border-border bg-background-solid/60 px-3 py-1.5 text-[12px] font-semibold text-foreground transition-opacity hover:opacity-85"
          >
            {isPlaying ? "Stop" : "Play"}
          </button>
          <button
            type="button"
            onClick={toggleMute}
            disabled={!isPlaying}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-opacity hover:opacity-85 disabled:opacity-50 ${
              isMuted
                ? "border-coral/40 bg-coral/15 text-coral"
                : "border-border bg-background-solid/60 text-foreground"
            }`}
            aria-pressed={isMuted}
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            {isMuted ? "Muted" : "Mute"}
          </button>
          <div className="flex flex-1 items-center gap-2">
            <Volume2 className="h-3.5 w-3.5 shrink-0 text-warm-gray" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full"
              aria-label="Volume"
            />
          </div>
        </div>

        <p className="text-[11px] text-warm-gray">
          Sound stays on while you switch tabs. Spotify support is coming.
        </p>
      </div>
    </div>
  );
}
