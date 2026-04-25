import { motion } from "motion/react";
import { Check, X } from "lucide-react";

interface FocusCheckToastProps {
  type: 'verified' | 'distracted';
}

export function FocusCheckToast({ type }: FocusCheckToastProps) {
  const isVerified = type === 'verified';

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className={`absolute top-6 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg z-20 ${
        isVerified ? 'bg-moss' : 'bg-coral'
      }`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center gap-2 text-primary-foreground">
        {isVerified ? (
          <Check className="w-4 h-4" strokeWidth={2.5} />
        ) : (
          <X className="w-4 h-4" strokeWidth={2.5} />
        )}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {isVerified ? 'Focus check ✓' : 'Focus check ✗ — put the phone down'}
        </span>
      </div>
    </motion.div>
  );
}
