import { IntensityLevel, BannerPhase } from './intensityPresets';

// ── Types ─────────────────────────────────────────────────────

export interface GreetingSegment {
  text: string;
  italic: boolean;
}

export interface GreetingParams {
  phase: BannerPhase;
  intensity: IntensityLevel;
  /** Today's total usage minutes */
  todayMin: number;
  /** Daily target minutes (0 = no target yet) */
  targetMin: number;
  /** Number of days this week that were under target (0–7) */
  goodDaysThisWeek: number;
  /** Current streak length */
  streak: number;
  /** 0–23 hour of day */
  hour: number;
}

// Greeting strings use {word} to mark the italic accent word.
// \n is an explicit line break — only added when the string exceeds ~27 chars.

// ── Greeting strings ──────────────────────────────────────────

const G = {
  observer: {
    gentle:   'Getting to know\nyour {patterns}.',
    balanced: 'Baseline in {progress}.',
    strict:   '{Observing.}\nNo targets yet.',
  },
  fresh: {
    gentle:   'A {quiet} morning so far.',
    balanced: '{Light} start today.',
    strict:   '{Clean} so far.',
  },
  onTrack: {
    gentle:   'On a {good} pace today.',
    balanced: 'On {track} today.',
    strict:   'On {target}.',
  },
  over: {
    gentle:   'A bit {over} today.',
    balanced: '{Over} today\'s target.',
    strict:   'Target {exceeded}.',
  },
  under: {
    gentle:   'Well {under} — solid day.',
    balanced: 'Well {under}\ntoday\'s target.',
    strict:   '{Under}. Keep it.',
  },
  goodWeek: {
    gentle:   '{Strong} week —\ntoday can seal it.',
    balanced: '{Good} week so far.',
    strict:   '{Good} week.',
  },
  roughWeek: {
    gentle:   'Tough week —\ntoday\'s a {fresh} start.',
    balanced: 'Rough week —\n{reset} today.',
    strict:   'Rough week. {Reset}.',
  },
  streak: (n: number): Record<IntensityLevel, string> => ({
    gentle:   `Day ${n} —\nyou're on a {streak}.`,
    balanced: `${n}-day {streak}.`,
    strict:   `{Streak}:\nday ${n}.`,
  }),
  maintenance: {
    gentle:   'Holding the {line}.',
    balanced: 'In {maintenance} mode.',
    strict:   '{Maintained}.',
  },
};

// ── Parser ────────────────────────────────────────────────────

/** Splits a greeting string into plain + italic segments. */
export function parseGreeting(text: string): GreetingSegment[] {
  const parts = text.split(/\{([^}]+)\}/);
  return parts.map((p, i) => ({ text: p, italic: i % 2 === 1 })).filter((s) => s.text.length > 0);
}

// ── Selector ─────────────────────────────────────────────────

/**
 * Returns a raw greeting string (with {word} markers and \n breaks).
 * Pass through parseGreeting() before rendering.
 *
 * Priority:
 *   1. streak ≥ 3
 *   2. weekly trend (good or rough)
 *   3. daily usage state
 *   4. phase fallback (observer / maintenance)
 */
export function getGreeting(params: GreetingParams): string {
  const { phase, intensity, todayMin, targetMin, goodDaysThisWeek, streak } = params;

  // Phase: observer — no targets yet
  if (phase === 'observer') return G.observer[intensity];

  // Phase: maintenance
  if (phase === 'maintenance') return G.maintenance[intensity];

  // Priority 1 — streak ≥ 3
  if (streak >= 3) return G.streak(streak)[intensity];

  // Priority 2 — weekly trend
  //   good week: ≥ 4 of the past days were under target
  //   rough week: ≤ 1 of the past days were under target
  if (goodDaysThisWeek >= 4) return G.goodWeek[intensity];
  if (goodDaysThisWeek <= 1 && targetMin > 0) return G.roughWeek[intensity];

  // Priority 3 — daily usage vs target
  if (targetMin > 0) {
    if (todayMin > targetMin) return G.over[intensity];
    // "Well under" = using ≤ 60% of target
    if (todayMin <= targetMin * 0.6) return G.under[intensity];
    return G.onTrack[intensity];
  }

  // Fallback: fresh / light
  return G.fresh[intensity];
}
