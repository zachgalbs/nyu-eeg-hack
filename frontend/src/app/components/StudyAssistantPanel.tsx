import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

export function StudyAssistantPanel({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
        aria-label="Close assistant"
      />
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl border border-border bg-card px-5 pb-8 pt-4 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Study Assistant</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border bg-background-solid/60 p-1.5 text-warm-gray transition-opacity hover:opacity-80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-warm-gray">Assistant coming soon.</p>
      </div>
    </div>
  );
}
