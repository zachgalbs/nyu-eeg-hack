import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

type Msg = { role: 'user' | 'assistant'; text: string };

const canned = (q: string): string => {
  const lower = q.toLowerCase();
  if (lower.includes('pomodoro') || lower.includes('break'))
    return 'Short breaks help; try 25 minutes on, 5 off, and adjust to what feels sustainable.';
  if (lower.includes('focus') || lower.includes('distract'))
    return 'One trick: write the next tiny step on paper, then do only that for two minutes.';
  if (lower.includes('sql') || lower.includes('code'))
    return 'For syntax questions, the MDN or official docs are usually fastest — this panel is for study habits, not a full debugger.';
  return 'Good question. For the prototype, answers are canned — later this can plug into a model. Keep questions short so you stay in flow.';
};

async function mockReply(question: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
  return canned(question.trim() || '…');
}

interface StudyAssistantPanelProps {
  onClose: () => void;
}

export function StudyAssistantPanel({ onClose }: StudyAssistantPanelProps) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      text: 'Ask a quick study question here so you are less tempted to open other tabs. This is Q&A only — not activity watching.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const text = await mockReply(q);
      setMessages((m) => [...m, { role: 'assistant', text }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[50] bg-ink/25"
        aria-label="Close assistant"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex justify-center px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <motion.aside
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="pointer-events-auto flex max-h-[min(85vh,560px)] w-full max-w-6xl flex-col rounded-t-2xl border border-border border-b-0 bg-card shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-ink" style={{ fontSize: '16px', fontWeight: 600 }}>
                Quick question
              </h2>
              <p className="text-warm-gray" style={{ fontSize: '12px' }}>
                Q&A only — not surveillance
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 text-warm-gray transition-opacity hover:opacity-70"
              style={{ fontSize: '13px' }}
            >
              Close
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-2xl px-3 py-2 ${
                  m.role === 'user'
                    ? 'ml-8 bg-primary/20 text-foreground'
                    : 'mr-6 bg-mountain/25 text-foreground'
                }`}
                style={{ fontSize: '14px', lineHeight: 1.45 }}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <p className="text-warm-gray" style={{ fontSize: '13px' }}>
                …
              </p>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="e.g. How long should breaks be?"
                className="min-w-0 flex-1 rounded-xl border border-border bg-snow px-3 py-2 text-ink outline-none focus:border-mountain"
                style={{ fontSize: '14px' }}
              />
              <button
                type="button"
                onClick={send}
                disabled={loading}
                className="shrink-0 rounded-full bg-primary px-4 py-2 text-primary-foreground transition-opacity disabled:opacity-50"
                style={{ fontWeight: 600, fontSize: '14px' }}
              >
                Send
              </button>
            </div>
          </div>
        </motion.aside>
      </div>
    </>
  );
}
