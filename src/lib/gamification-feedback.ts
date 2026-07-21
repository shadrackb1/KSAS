import confetti from 'canvas-confetti';
import { STREAK_MULTIPLIERS, XP_REWARDS } from './gamification';

// ─── Reduced Motion ──────────────────────────────────────────────────────────

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
let _reducedMotion: boolean | null = null;

export function prefersReducedMotion(): boolean {
  if (_reducedMotion !== null) return _reducedMotion;
  if (typeof window === 'undefined') return false;
  _reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
  window.matchMedia(REDUCED_MOTION_QUERY).addEventListener('change', (e) => {
    _reducedMotion = e.matches;
  });
  return _reducedMotion;
}

// ─── Sound Effects (Web Audio API) ───────────────────────────────────────────

const SOUND_STORAGE_KEY = 'ksas_sound_effects_enabled';

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch { return null; }
  }
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  // Resume if suspended (autoplay policy)
  if (ctx.state === 'suspended') ctx.resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playChime(notes: number[], interval = 0.1, type: OscillatorType = 'sine', volume = 0.12) {
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.3, type, volume), i * interval * 1000);
  });
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SOUND_STORAGE_KEY) === 'true';
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
  // Initialize AudioContext on first user interaction
  if (enabled) getAudioCtx();
}

export function playXpGain() {
  if (!isSoundEnabled()) return;
  playChime([880, 1100], 0.08, 'sine', 0.1);
}

export function playBadgeUnlock() {
  if (!isSoundEnabled()) return;
  playChime([523, 659, 784, 1047], 0.1, 'sine', 0.12);
}

export function playLevelUp() {
  if (!isSoundEnabled()) return;
  playChime([523, 659, 784, 1047, 1319], 0.09, 'triangle', 0.15);
}

// ─── Confetti Presets ────────────────────────────────────────────────────────

const KABU_MAROON = '#8B1A2B';
const GOLD = '#C5A55A';

export function confettiCheckin() {
  if (prefersReducedMotion()) return;
  confetti({
    particleCount: 40,
    spread: 55,
    origin: { y: 0.6 },
    colors: [KABU_MAROON, GOLD, '#ffffff'],
    gravity: 1.2,
    scalar: 0.8,
    drift: 0,
    ticks: 120,
  });
}

export function confettiBadgeUnlock() {
  if (prefersReducedMotion()) return;
  confetti({
    particleCount: 60,
    spread: 70,
    origin: { y: 0.55 },
    colors: [GOLD, '#FFD700', '#ffffff', KABU_MAROON],
    gravity: 0.9,
    scalar: 1.0,
    ticks: 150,
  });
}

export function confettiLevelUp() {
  if (prefersReducedMotion()) return;
  // Big burst from both sides
  const end = Date.now() + 800;
  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: [KABU_MAROON, GOLD, '#ffffff'],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: [KABU_MAROON, GOLD, '#ffffff'],
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
  // Final big burst
  setTimeout(() => {
    confetti({
      particleCount: 80,
      spread: 100,
      origin: { y: 0.4 },
      colors: [KABU_MAROON, GOLD, '#ffffff', '#FFD700'],
      gravity: 0.7,
      scalar: 1.2,
      ticks: 200,
    });
  }, 400);
}

// ─── Streak Multiplier Helpers ───────────────────────────────────────────────

export function getStreakMultiplier(streakDays: number): number {
  return STREAK_MULTIPLIERS.find(m => streakDays >= m.days)?.multiplier || 1.0;
}

export function computeCheckinXpBreakdown(streakDays: number): {
  baseXp: number;
  multiplier: number;
  bonusLabel: string;
  finalXp: number;
} {
  const baseXp = XP_REWARDS.CHECKIN;
  const multiplier = getStreakMultiplier(streakDays);
  const finalXp = Math.round(baseXp * multiplier);
  const bonusLabel = multiplier > 1
    ? `+${baseXp} XP × ${multiplier} streak bonus = +${finalXp} XP`
    : `+${finalXp} XP`;
  return { baseXp, multiplier, bonusLabel, finalXp };
}

// ─── Haptic Pulse ────────────────────────────────────────────────────────────

export function hapticPulse(duration = 50) {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try { navigator.vibrate(duration); } catch { /* ignore */ }
}
