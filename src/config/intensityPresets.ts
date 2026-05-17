/**
 * Single source of truth for all intensity preset parameters.
 *
 * To tune behaviour, edit ONLY this file. The values are written to
 * SharedPreferences at onboarding and every time the user changes their
 * preset in Settings. The native UsageMonitorService reads the resolved
 * numbers — it has no knowledge of preset names.
 *
 * Parameters:
 *   sampleDays          — days of data collected before nudging begins
 *   weeklyReductionPct  — target drops by this % each week (0.10 = 10%)
 *   nudgeBufferPct      — nudge fires when usage exceeds target by this % (0 = at target)
 *   frictionType        — 'reminder' | 'soft' | 'hard'
 *   cooldownMinutes     — minimum gap between consecutive nudges for the same app
 *   baselineCapMinutes  — max starting baseline regardless of observed usage
 *   floorMinutes        — minimum daily target; no nudges below this
 */

export type FrictionType = 'reminder' | 'soft' | 'hard';
export type IntensityLevel = 'gentle' | 'balanced' | 'strict';

// ─── Per-intensity colour palettes ───────────────────────────────────────────
export interface IntensityColors {
  bg: string;
  surface: string;
  border: string;
  accent: string;
  accentLight: string;
}

export const INTENSITY_COLORS: Record<IntensityLevel, IntensityColors> = {
  gentle: {
    bg:          '#081a0e',  // deep forest green
    surface:     '#0f2318',
    border:      '#1a3d26',
    accent:      '#22c55e',  // green-500
    accentLight: '#4ade80',  // green-400
  },
  balanced: {
    bg:          '#0f172a',  // slate-900 (default)
    surface:     '#1e293b',
    border:      '#334155',
    accent:      '#6366f1',  // indigo-500
    accentLight: '#818cf8',  // indigo-400
  },
  strict: {
    bg:          '#1a0808',  // deep crimson dark
    surface:     '#2d1212',
    border:      '#4a1f1f',
    accent:      '#ef4444',  // red-500
    accentLight: '#f87171',  // red-400
  },
};

export interface IntensityPreset {
  label: string;
  tagline: string;
  description: string;
  sampleDays: number;
  weeklyReductionPct: number;
  nudgeBufferPct: number;
  frictionType: FrictionType;
  cooldownMinutes: number;
  baselineCapMinutes: number;
  floorMinutes: number;
}

export const INTENSITY_PRESETS: Record<IntensityLevel, IntensityPreset> = {
  gentle: {
    label: 'Gentle',
    tagline: 'Slow and steady',
    description:
      'ScrollGuard watches for a full week before nudging. ' +
      'Targets drop 10% per week. Nudges are soft reminders — no friction.',
    sampleDays: 7,
    weeklyReductionPct: 0.10,
    nudgeBufferPct: 0.15,
    frictionType: 'reminder',
    cooldownMinutes: 60,
    baselineCapMinutes: 240,   // 4 hours
    floorMinutes: 45,
  },

  balanced: {
    label: 'Balanced',
    tagline: 'Standard pace',
    description:
      'ScrollGuard builds your baseline in 4 days, then nudges with a ' +
      '5-second pause before re-opening monitored apps. Targets drop 20% per week.',
    sampleDays: 4,
    weeklyReductionPct: 0.20,
    nudgeBufferPct: 0.10,
    frictionType: 'soft',
    cooldownMinutes: 30,
    baselineCapMinutes: 180,   // 3 hours
    floorMinutes: 30,
  },

  strict: {
    label: 'Strict',
    tagline: 'Fast change',
    description:
      'ScrollGuard starts nudging after just 2 days. ' +
      'Every re-open of a monitored app requires a conscious tap. Targets drop 30% per week.',
    sampleDays: 2,
    weeklyReductionPct: 0.30,
    nudgeBufferPct: 0.0,
    frictionType: 'hard',
    cooldownMinutes: 15,
    baselineCapMinutes: 120,   // 2 hours
    floorMinutes: 20,
  },
};

export const DEFAULT_INTENSITY: IntensityLevel = 'balanced';

// ─── Phase-aware banner messages ─────────────────────────────────────────────
// All numbers are derived from IntensityPreset at render time.
// To change a value: edit the preset above — messages update automatically.

export type BannerPhase = 'observer' | 'active' | 'progress' | 'maintenance';

export interface BannerMessage {
  title: (preset: IntensityPreset, week: number) => string;
  body:  (preset: IntensityPreset, week: number) => string;
}

export interface IntensityBannerMessages {
  observer:    BannerMessage;
  active:      BannerMessage;
  progress:    BannerMessage;
  maintenance: BannerMessage;
}

export const INTENSITY_MESSAGES: Record<IntensityLevel, IntensityBannerMessages> = {
  gentle: {
    observer: {
      title: () => 'Watching quietly 👁',
      body:  (p) =>
        `No nudges for ${p.sampleDays} days — ScrollGuard is learning your patterns at your own pace. Honest data, zero pressure.`,
    },
    active: {
      title: () => 'Nudges are live 🌱',
      body:  (p) =>
        `Soft reminders only — at most one nudge every ${p.cooldownMinutes} minutes. Targets drop ${Math.round(p.weeklyReductionPct * 100)}% each week.`,
    },
    progress: {
      title: (p, week) => `Week ${week} — keep going 🌿`,
      body:  (p, week) =>
        `Targeting ~${Math.min(Math.round(p.weeklyReductionPct * (week - 1) * 100), 70)}% less than your starting point. Gentle and steady wins.`,
    },
    maintenance: {
      title: () => 'You found your floor 🎉',
      body:  (p) =>
        `Minimum target of ${p.floorMinutes} min/day reached. ScrollGuard keeps watch to help you hold it.`,
    },
  },

  balanced: {
    observer: {
      title: () => 'Building your baseline 📊',
      body:  (p) =>
        `ScrollGuard watches silently for ${p.sampleDays} days, then sets your personal targets. Nudges start after that.`,
    },
    active: {
      title: () => 'Targets are live ⚡',
      body:  (p) =>
        `Baseline locked in. Cutting ${Math.round(p.weeklyReductionPct * 100)}% per week — ${p.cooldownMinutes}-minute cooldown between nudges.`,
    },
    progress: {
      title: (p, week) => `Week ${week} — building momentum 📈`,
      body:  (p, week) =>
        `Down ~${Math.min(Math.round(p.weeklyReductionPct * (week - 1) * 100), 70)}% from your starting point. ${Math.round(p.weeklyReductionPct * 100)}% weekly cuts continue.`,
    },
    maintenance: {
      title: () => 'Floor reached 🏆',
      body:  (p) =>
        `Holding at ${p.floorMinutes} min/day minimum. ScrollGuard stays active to make sure you hold the line.`,
    },
  },

  strict: {
    observer: {
      title: (p) => `${p.sampleDays}-day baseline 🎯`,
      body:  (p) =>
        `Just ${p.sampleDays} days of data is all ScrollGuard needs. Your first nudge is coming very soon.`,
    },
    active: {
      title: () => 'Reduction starts now 🔒',
      body:  (p) =>
        `Every re-open needs a conscious tap. Cutting ${Math.round(p.weeklyReductionPct * 100)}% per week — nudges cool down after ${p.cooldownMinutes} minutes.`,
    },
    progress: {
      title: (p, week) => `Week ${week} — staying sharp 🔥`,
      body:  (p, week) =>
        `~${Math.min(Math.round(p.weeklyReductionPct * (week - 1) * 100), 70)}% below your baseline. ${Math.round(p.weeklyReductionPct * 100)}% weekly cuts still in effect.`,
    },
    maintenance: {
      title: () => 'Target locked in 🎯',
      body:  (p) =>
        `Floor of ${p.floorMinutes} min/day achieved. The hard work paid off — ScrollGuard holds the line.`,
    },
  },
};

/**
 * Determines which banner phase the user is in.
 * - observer:    still within the sampleDays baseline window
 * - active:      nudging started, weeks 1-2
 * - progress:    week 3 onwards, showing reduction progress
 * - maintenance: ~1 full reduction cycle complete
 */
export function getBannerPhase(
  daysSinceInstall: number,
  currentWeek: number,
  preset: IntensityPreset,
): BannerPhase {
  if (daysSinceInstall < preset.sampleDays) return 'observer';
  const maintenanceWeek = Math.round(1 / preset.weeklyReductionPct) + 1;
  if (currentWeek >= maintenanceWeek) return 'maintenance';
  if (currentWeek >= 3) return 'progress';
  return 'active';
}
