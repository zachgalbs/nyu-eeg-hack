import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { markOnboardingComplete } from '../../lib/onboarding';

const EASE_OUT: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

/**
 * Onboarding: distant mountain vista → ease-out zoom (see docs/ONBOARDING_ZOOM.md).
 */
export function WelcomeScreen() {
  const navigate = useNavigate();
  const skyId = useId().replace(/:/g, '');
  const [zoomed, setZoomed] = useState(false);
  const [showCta, setShowCta] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setZoomed(true), 500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!zoomed) return;
    const t = window.setTimeout(() => setShowCta(true), 1020);
    return () => window.clearTimeout(t);
  }, [zoomed]);

  const finish = () => {
    markOnboardingComplete();
    navigate('/calendar', { replace: true });
  };

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-6xl overflow-hidden px-4 text-ink sm:px-8 lg:px-10">
      <button
        type="button"
        onClick={finish}
        className="absolute top-6 right-6 z-20 text-warm-gray"
        style={{ fontSize: '13px', fontFamily: 'var(--font-sans)' }}
      >
        Skip
      </button>

      <div className="absolute inset-0 flex flex-col items-center justify-center pt-10">
        <motion.div
          className="w-full px-2 flex items-center justify-center"
          style={{ transformOrigin: '50% 65%' }}
          initial={{ scale: 0.42, y: 72 }}
          animate={zoomed ? { scale: 1, y: 0 } : { scale: 0.42, y: 72 }}
          transition={{ duration: 1, ease: EASE_OUT }}
        >
          <svg
            viewBox="0 0 100 100"
            className="aspect-[10/11] w-full max-w-[min(100vw,720px)] select-none sm:aspect-[16/11] lg:max-w-[900px]"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
            <defs>
              <linearGradient id={skyId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#F4D8BA" />
                <stop offset="100%" stopColor="#FBF2E4" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" fill={`url(#${skyId})`} />

            <path
              d="M -5 78 L 12 55 L 22 58 L 18 100 L -5 100 Z"
              fill="#4A6B54"
              opacity="0.32"
            />
            <path
              d="M 78 72 L 92 48 L 100 52 L 100 100 L 72 100 Z"
              fill="#4A6B54"
              opacity="0.28"
            />

            <path
              d="M 0 88 Q 18 62 32 58 L 38 48 Q 46 36 54 28 L 62 18 Q 66 10 70 8 L 74 12 Q 78 20 82 26 L 88 38 Q 94 52 100 62 L 100 100 L 0 100 Z"
              fill="#4A6B54"
              opacity="0.92"
            />
            <path
              d="M 62 18 Q 66 10 70 8 L 74 12 Q 76 14 77 16 L 72 22 L 64 24 Z"
              fill="#FDFBF7"
              opacity="0.92"
            />
            <path
              d="M 52 28 Q 58 22 64 24 L 68 30 Q 62 38 56 42 Q 54 36 52 28 Z"
              fill="#FDFBF7"
              opacity="0.75"
            />

            <path
              d="M 48 92 L 46 84 L 50 76 L 48 68 L 52 58 L 50 48 L 54 38 L 52 28 L 56 18 L 58 12 L 62 8"
              fill="none"
              stroke="#FDFBF7"
              strokeWidth="0.35"
              strokeDasharray="1.2 1.4"
              opacity="0.55"
            />
          </svg>
        </motion.div>

        <motion.div
          className="relative z-10 mt-6 px-8 text-center max-w-md"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: showCta ? 1 : 0, y: showCta ? 0 : 12 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
        >
          <h1
            className="text-ink mb-3"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '32px',
              fontWeight: 400,
              lineHeight: 1.15,
            }}
          >
            Your day is a mountain.
          </h1>
          <p className="text-warm-gray mb-8" style={{ fontSize: '13px', lineHeight: 1.5 }}>
            Plan in the calendar, check into a block, stay focused, and climb the trail—one calm
            step at a time.
          </p>
          <button
            type="button"
            onClick={finish}
            className="w-full py-3 px-6 bg-primary text-primary-foreground transition-opacity hover:opacity-90"
            style={{ borderRadius: '999px', fontWeight: 600 }}
          >
            Begin
          </button>
        </motion.div>
      </div>
    </div>
  );
}
