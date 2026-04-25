import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Volume2 } from "lucide-react";

type RoastTrigger = "auto" | "friend_throw";

interface RoastModalProps {
  onClose: () => void;
  roastText: string;
  trigger: RoastTrigger;
  fromName?: string;
}

export function RoastModal({ onClose, roastText, trigger, fromName }: RoastModalProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const title = trigger === "friend_throw" ? "friend throw landed" : "caught slacking";
  const contextLine =
    trigger === "friend_throw"
      ? `sent by ${fromName || "a friend"}`
      : "auto check triggered by repeated distraction";

  useEffect(() => {
    let currentIndex = 0;
    const typewriterInterval = setInterval(() => {
      if (currentIndex < roastText.length) {
        setDisplayedText(roastText.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typewriterInterval);
        setIsPlaying(true);
      }
    }, 40);

    return () => clearInterval(typewriterInterval);
  }, [roastText]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{
        background: '#1c2229',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg width="100" height="100" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noise"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" /%3E%3C/filter%3E%3Crect width="100" height="100" filter="url(%23noise)" opacity="0.05" /%3E%3C/svg%3E")',
      }}
    >
      <div className="relative z-10 max-w-[380px] w-full text-center">
        {isPlaying && (
          <div className="absolute top-0 right-0 sm:top-2 sm:right-2">
            <Volume2 className="w-5 h-5 text-snow opacity-40 animate-pulse" />
          </div>
        )}

        <h1
          className="text-snow mb-8"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '32px',
            fontWeight: 400,
          }}
        >
          {title}
        </h1>

        <p
          className="text-snow mb-8 min-h-[64px] italic"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '20px',
            lineHeight: 1.4,
          }}
        >
          {displayedText}
        </p>

        <p
          className="text-snow opacity-50 mb-12"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
          }}
        >
          {contextLine}
        </p>

        <div className="space-y-3">
          <button
            onClick={onClose}
            className="w-full py-3 px-6 bg-primary text-primary-foreground transition-opacity hover:opacity-90"
            style={{ borderRadius: '999px', fontWeight: 600 }}
          >
            lock back in
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 px-6 text-snow opacity-60 hover:opacity-100 transition-opacity"
            style={{ fontWeight: 600 }}
          >
            take a break
          </button>
        </div>
      </div>
    </motion.div>
  );
}
