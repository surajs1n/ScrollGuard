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
