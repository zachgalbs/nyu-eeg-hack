import { useEffect, useState } from "react";

export type FocusTrackId = "rain" | "ocean" | "wind" | "forest";

export type FocusTrackMeta = {
  id: FocusTrackId;
  label: string;
  hint: string;
};

export const FOCUS_TRACKS: FocusTrackMeta[] = [
  { id: "rain", label: "rain", hint: "steady drizzle" },
  { id: "ocean", label: "ocean", hint: "low rolling waves" },
  { id: "wind", label: "wind", hint: "soft mountain wind" },
  { id: "forest", label: "forest", hint: "leaves and distant chirps" },
];

type StoredState = {
  trackId: FocusTrackId;
  isMuted: boolean;
  volume: number;
  isPlaying: boolean;
};

const STORAGE_KEY = "compcal_focus_audio_v1";
const DEFAULT_STATE: StoredState = {
  trackId: "rain",
  isMuted: false,
  volume: 0.35,
  isPlaying: false,
};

function readStored(): StoredState {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_STATE;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return DEFAULT_STATE;
  }
}

function writeStored(state: StoredState) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

type Engine = {
  ctx: AudioContext;
  master: GainNode;
  stop: () => void;
};

let engine: Engine | null = null;
let listeners = new Set<() => void>();
let state: StoredState = readStored();

function notify() {
  for (const fn of listeners) fn();
}

function makeNoiseBuffer(ctx: AudioContext, color: "white" | "pink" | "brown") {
  const length = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  if (color === "white") {
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
  if (color === "pink") {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }
  // brown
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

function startEngine(trackId: FocusTrackId): Engine {
  const Ctor = (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    ?? window.AudioContext;
  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = state.isMuted ? 0 : state.volume;
  master.connect(ctx.destination);

  const sources: { stop: () => void }[] = [];

  if (trackId === "rain") {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, "white");
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 800;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 6000;
    src.connect(hp).connect(lp).connect(master);
    src.start();
    sources.push({ stop: () => src.stop() });
  } else if (trackId === "ocean") {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, "brown");
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    const swell = ctx.createGain();
    swell.gain.value = 0.6;
    // Slow LFO swell to mimic waves rolling in.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.5;
    lfo.connect(lfoGain).connect(swell.gain);
    src.connect(lp).connect(swell).connect(master);
    src.start();
    lfo.start();
    sources.push({ stop: () => { src.stop(); lfo.stop(); } });
  } else if (trackId === "wind") {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, "pink");
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 500;
    bp.Q.value = 0.7;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(bp.frequency);
    src.connect(bp).connect(master);
    src.start();
    lfo.start();
    sources.push({ stop: () => { src.stop(); lfo.stop(); } });
  } else {
    // forest: pink noise floor + occasional high-pitched chirp blips
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, "pink");
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1800;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.7;
    src.connect(lp).connect(noiseGain).connect(master);
    src.start();

    let chirpStopped = false;
    const scheduleChirp = () => {
      if (chirpStopped) return;
      const delay = 2 + Math.random() * 5;
      window.setTimeout(() => {
        if (chirpStopped) return;
        const chirp = ctx.createOscillator();
        chirp.type = "sine";
        const f = 1800 + Math.random() * 1600;
        chirp.frequency.setValueAtTime(f, ctx.currentTime);
        chirp.frequency.exponentialRampToValueAtTime(f * 1.5, ctx.currentTime + 0.18);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
        chirp.connect(g).connect(master);
        chirp.start();
        chirp.stop(ctx.currentTime + 0.3);
        scheduleChirp();
      }, delay * 1000);
    };
    scheduleChirp();
    sources.push({
      stop: () => {
        chirpStopped = true;
        src.stop();
      },
    });
  }

  return {
    ctx,
    master,
    stop: () => {
      sources.forEach((s) => {
        try { s.stop(); } catch { /* already stopped */ }
      });
      try { ctx.close(); } catch { /* ignore */ }
    },
  };
}

function applyEngineState() {
  if (!engine) return;
  const target = state.isMuted ? 0 : state.volume;
  // Smooth transition to avoid clicks.
  const now = engine.ctx.currentTime;
  engine.master.gain.cancelScheduledValues(now);
  engine.master.gain.setTargetAtTime(target, now, 0.05);
}

function ensurePlaying() {
  if (!state.isPlaying) return;
  if (engine) return;
  try {
    engine = startEngine(state.trackId);
  } catch {
    /* AudioContext unavailable until first user gesture; caller will retry on next interaction */
  }
}

function teardown() {
  if (!engine) return;
  engine.stop();
  engine = null;
}

function persist() {
  writeStored(state);
}

export function focusAudioPlay() {
  state = { ...state, isPlaying: true };
  persist();
  ensurePlaying();
  notify();
}

export function focusAudioPause() {
  state = { ...state, isPlaying: false };
  persist();
  teardown();
  notify();
}

export function focusAudioToggleMute() {
  state = { ...state, isMuted: !state.isMuted };
  persist();
  applyEngineState();
  notify();
}

export function focusAudioSetTrack(trackId: FocusTrackId) {
  if (state.trackId === trackId) return;
  state = { ...state, trackId };
  persist();
  if (state.isPlaying) {
    teardown();
    ensurePlaying();
  }
  notify();
}

export function focusAudioSetVolume(volume: number) {
  const clamped = Math.max(0, Math.min(1, volume));
  state = { ...state, volume: clamped };
  persist();
  applyEngineState();
  notify();
}

export function useFocusAudio() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return {
    trackId: state.trackId,
    isMuted: state.isMuted,
    volume: state.volume,
    isPlaying: state.isPlaying,
    play: focusAudioPlay,
    pause: focusAudioPause,
    toggleMute: focusAudioToggleMute,
    setTrack: focusAudioSetTrack,
    setVolume: focusAudioSetVolume,
  } as const;
}
