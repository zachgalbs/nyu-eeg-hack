export type BuddyCommitment = {
  buddyId: string;
  buddyName: string;
  eventId: string;
  eventTitle: string;
  createdAt: string;
};

export type SessionOutcome = {
  id: string;
  eventId: string;
  eventTitle: string;
  plannedMinutes: number;
  /** Real wall-clock minutes the user spent in non-paused state. */
  completedMinutes: number;
  /** Camera-weighted minutes (1x with camera on, 0.5x off). Drives commitment + cat summit. */
  effectiveMinutes?: number;
  /** Whether the camera was on for the majority of the session. */
  cameraEnabled?: boolean;
  focusScore: number;
  distractedChecks: number;
  keptCommitment: boolean;
  buddyId?: string;
  buddyName?: string;
  completedAt: string;
};

export type CompcalPrefs = {
  focusChecksEnabled: boolean;
  lowPressureMode: boolean;
};

const OUTCOMES_KEY = "compcal_session_outcomes_v1";
const BUDDY_KEY = "compcal_buddy_commitments_v1";
const PREFS_KEY = "compcal_prefs_v1";
const DEFAULT_PREFS: CompcalPrefs = {
  focusChecksEnabled: true,
  lowPressureMode: false,
};

function safeRead<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore storage failures in prototype */
  }
}

export function getPrefs(): CompcalPrefs {
  return { ...DEFAULT_PREFS, ...safeRead<Partial<CompcalPrefs>>(PREFS_KEY, {}) };
}

export function updatePrefs(partial: Partial<CompcalPrefs>): CompcalPrefs {
  const next = { ...getPrefs(), ...partial };
  safeWrite(PREFS_KEY, next);
  return next;
}

export function setBuddyCommitment(commitment: BuddyCommitment): void {
  const all = getBuddyCommitments().filter((c) => c.eventId !== commitment.eventId);
  all.unshift(commitment);
  safeWrite(BUDDY_KEY, all.slice(0, 30));
}

export function clearBuddyCommitment(eventId: string): void {
  const remaining = getBuddyCommitments().filter((c) => c.eventId !== eventId);
  safeWrite(BUDDY_KEY, remaining);
}

export function getBuddyCommitments(): BuddyCommitment[] {
  return safeRead<BuddyCommitment[]>(BUDDY_KEY, []);
}

export function getBuddyCommitment(eventId: string): BuddyCommitment | null {
  return getBuddyCommitments().find((c) => c.eventId === eventId) ?? null;
}

export function saveSessionOutcome(outcome: SessionOutcome): void {
  const all = getSessionOutcomes().filter((s) => s.id !== outcome.id);
  all.unshift(outcome);
  safeWrite(OUTCOMES_KEY, all.slice(0, 50));
}

export function getSessionOutcomes(): SessionOutcome[] {
  return safeRead<SessionOutcome[]>(OUTCOMES_KEY, []);
}

export function getLatestSessionOutcome(eventId?: string): SessionOutcome | null {
  const all = getSessionOutcomes();
  if (!all.length) return null;
  if (!eventId) return all[0];
  return all.find((s) => s.eventId === eventId) ?? all[0];
}

export function getDailyCommitmentSummary(): {
  completedSessions: number;
  keptCommitments: number;
  avgFocusScore: number;
  totalFocusedMinutes: number;
} {
  const all = getSessionOutcomes();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const recent = all.filter((s) => new Date(s.completedAt).getTime() >= startOfToday.getTime());
  const totalFocusedMinutes = recent.reduce((sum, s) => sum + s.completedMinutes, 0);
  const keptCommitments = recent.filter((s) => s.keptCommitment).length;
  const avgFocusScore = recent.length
    ? Math.round(recent.reduce((sum, s) => sum + s.focusScore, 0) / recent.length)
    : 0;
  return {
    completedSessions: recent.length,
    keptCommitments,
    avgFocusScore,
    totalFocusedMinutes,
  };
}

export function getWeeklyCommitmentSummary(): {
  completedSessions: number;
  keptCommitments: number;
  avgClimbPct: number;
  totalFocusedMinutes: number;
  /** 7-element array Mon..Sun. Each value is a 0-100 share of that day's focused minutes
   *  against the busiest day's minutes. Empty array when no sessions exist. */
  points: number[];
} {
  const all = getSessionOutcomes();
  // Anchor to Monday of this week so days line up with the bars rendered in Profile.
  const now = new Date();
  const mondayStart = new Date(now);
  const dayIdx = (mondayStart.getDay() + 6) % 7; // 0 = Monday
  mondayStart.setDate(mondayStart.getDate() - dayIdx);
  mondayStart.setHours(0, 0, 0, 0);
  const sundayEnd = mondayStart.getTime() + 7 * 24 * 60 * 60 * 1000;

  const recent = all.filter((s) => {
    const t = new Date(s.completedAt).getTime();
    return t >= mondayStart.getTime() && t < sundayEnd;
  });

  if (recent.length === 0) {
    return {
      completedSessions: 0,
      keptCommitments: 0,
      avgClimbPct: 0,
      totalFocusedMinutes: 0,
      points: [],
    };
  }

  const totalFocusedMinutes = recent.reduce((sum, s) => sum + s.completedMinutes, 0);
  const keptCommitments = recent.filter((s) => s.keptCommitment).length;

  // Per-session climb % uses effective minutes when present so camera-off sessions
  // visibly shrink. Falls back to completed/planned for older records.
  const climbPcts = recent.map((s) => {
    const numerator = typeof s.effectiveMinutes === "number" ? s.effectiveMinutes : s.completedMinutes;
    return Math.max(0, Math.min(100, (numerator / Math.max(1, s.plannedMinutes)) * 100));
  });
  const avgClimbPct = Math.round(climbPcts.reduce((a, b) => a + b, 0) / climbPcts.length);

  // Per-day buckets, Mon..Sun. Sum focused minutes per day, normalize against the busiest day.
  const buckets = Array.from({ length: 7 }, () => 0);
  for (const s of recent) {
    const t = new Date(s.completedAt);
    const idx = (t.getDay() + 6) % 7;
    buckets[idx] += s.completedMinutes;
  }
  const max = Math.max(...buckets);
  const points = max > 0
    ? buckets.map((m) => (m === 0 ? 0 : Math.max(8, Math.round((m / max) * 100))))
    : [];

  return {
    completedSessions: recent.length,
    keptCommitments,
    avgClimbPct,
    totalFocusedMinutes,
    points,
  };
}
