import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Pause } from "lucide-react";
import { MountainSVG } from "./MountainSVG";
import { FocusCheckToast } from "./FocusCheckToast";
import { RoastModal } from "./RoastModal";

const eventData: Record<string, any> = {
  '1': { name: "Deep Work: Design System", duration: 120 },
  '2': { name: "Team Standup", duration: 30 },
  '3': { name: "Focus Block: Code Review", duration: 120 },
  'active': { name: "Focus Session", duration: 60 },
};

export function MountainScreen() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const event = eventData[eventId || 'active'];

  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [progress, setProgress] = useState(20);
  const [focusScore, setFocusScore] = useState(97);
  const [lastCheck, setLastCheck] = useState<'verified' | 'distracted'>('verified');
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState<'verified' | 'distracted'>('verified');
  const [distractedCount, setDistractionCount] = useState(0);
  const [showRoast, setShowRoast] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedMinutes((prev) => {
        const next = prev + 1;
        const newProgress = Math.min(100, (next / event.duration) * 100);
        setProgress(newProgress);

        if (newProgress >= 100) {
          navigate(`/summit/${eventId}`);
        }

        return next;
      });
    }, 60000);

    const focusCheckInterval = setInterval(() => {
      const isDistracted = Math.random() < 0.15;
      const checkResult = isDistracted ? 'distracted' : 'verified';

      setLastCheck(checkResult);
      setToastType(checkResult);
      setShowToast(true);

      if (isDistracted) {
        setFocusScore((prev) => Math.max(70, prev - 3));
        setDistractionCount((prev) => {
          const newCount = prev + 1;
          if (newCount >= 3) {
            setShowRoast(true);
            return 0;
          }
          return newCount;
        });
      } else {
        setFocusScore((prev) => Math.min(100, prev + 1));
      }

      setTimeout(() => setShowToast(false), 2500);
    }, 10000);

    return () => {
      clearInterval(timer);
      clearInterval(focusCheckInterval);
    };
  }, [event.duration, eventId, navigate]);

  const formatTime = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}:${mins.toString().padStart(2, '0')}` : `${mins}m`;
  };

  return (
    <>
      <div className="relative h-screen w-full overflow-hidden">
        <div className="absolute inset-0">
          <MountainSVG progress={progress} climberName="You" />
        </div>

        <div className="absolute top-0 left-0 right-0 p-6 z-10">
          <div className="flex items-start justify-between">
            <div>
              <h2
                className="text-ink mb-1"
                style={{ fontFamily: 'var(--font-serif)', fontSize: '20px' }}
              >
                {event.name}
              </h2>
              <div
                className="text-ink"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 600 }}
              >
                {formatTime(elapsedMinutes)}
              </div>
            </div>
            <button className="p-2 text-ink opacity-60 hover:opacity-100 transition-opacity">
              <Pause className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div
          className="absolute bottom-24 left-4 right-4 bg-card p-4 border border-border z-10"
          style={{ borderRadius: '12px', boxShadow: 'var(--shadow-card)' }}
        >
          <div className="flex items-center gap-4">
            <div
              className="bg-warm-gray flex items-center justify-center text-[10px] text-snow"
              style={{ width: 80, height: 60, borderRadius: '8px' }}
            >
              <div className="text-center">
                <div className="w-2 h-2 bg-moss rounded-full mx-auto mb-1 animate-pulse"></div>
                LIVE
              </div>
            </div>

            <div className="flex-1">
              <div
                className="text-ink mb-1"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 600 }}
              >
                {focusScore}%
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    lastCheck === 'verified' ? 'bg-moss' : 'bg-coral'
                  }`}
                ></div>
                <span className="text-warm-gray" style={{ fontSize: '13px' }}>
                  {lastCheck === 'verified' ? 'focused' : 'distracted'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {showToast && <FocusCheckToast type={toastType} />}
      </div>

      {showRoast && <RoastModal onClose={() => setShowRoast(false)} />}
    </>
  );
}
