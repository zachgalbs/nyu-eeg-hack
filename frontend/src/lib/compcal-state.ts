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
  completedMinutes: number;
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

export function getWeeklyCommitmentSummary(): {
  completedSessions: number;
  keptCommitments: number;
  avgFocusScore: number;
  totalFocusedMinutes: number;
  points: number[];
} {
  const all = getSessionOutcomes();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - weekMs;
  const recent = all.filter((s) => new Date(s.completedAt).getTime() >= cutoff);
  const totalFocusedMinutes = recent.reduce((sum, s) => sum + s.completedMinutes, 0);
  const keptCommitments = recent.filter((s) => s.keptCommitment).length;
  const avgFocusScore = recent.length
    ? Math.round(recent.reduce((sum, s) => sum + s.focusScore, 0) / recent.length)
    : 0;
  const points = recent
    .slice()
    .reverse()
    .map((s) => Math.max(8, Math.min(100, Math.round((s.completedMinutes / Math.max(1, s.plannedMinutes)) * 100))));
  return {
    completedSessions: recent.length,
    keptCommitments,
    avgFocusScore,
    totalFocusedMinutes,
    points: points.slice(-7),
  };
}
