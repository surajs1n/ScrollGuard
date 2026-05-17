import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync('scrollguard.db');
    await initSchema(_db);
  }
  return _db;
}

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    -- Daily usage snapshots per app
    CREATE TABLE IF NOT EXISTS usage_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,          -- YYYY-MM-DD
      package_name TEXT NOT NULL,
      app_name TEXT NOT NULL,
      total_time_ms INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
    );

    -- Unique snapshot per day per app
    CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_date_pkg
      ON usage_snapshots(date, package_name);

    -- Activity log: when the user tapped "I did it"
    CREATE TABLE IF NOT EXISTS activity_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      activity_id TEXT NOT NULL,
      activity_label TEXT NOT NULL,
      completed_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
    );

    -- Streak tracking (updated daily by JS)
    CREATE TABLE IF NOT EXISTS streaks (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      last_active_date TEXT
    );

    INSERT OR IGNORE INTO streaks (id, current_streak, longest_streak)
      VALUES (1, 0, 0);
  `);
}

// ─── Usage Snapshots ────────────────────────────────────────────────────────

export interface UsageSnapshot {
  date: string;
  packageName: string;
  appName: string;
  totalTimeMs: number;
}

export async function upsertUsageSnapshot(snap: UsageSnapshot): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO usage_snapshots (date, package_name, app_name, total_time_ms)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date, package_name)
     DO UPDATE SET total_time_ms = excluded.total_time_ms,
                   app_name = excluded.app_name`,
    snap.date,
    snap.packageName,
    snap.appName,
    snap.totalTimeMs
  );
}

export async function getUsageForDate(date: string): Promise<UsageSnapshot[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    date: string;
    package_name: string;
    app_name: string;
    total_time_ms: number;
  }>(
    'SELECT * FROM usage_snapshots WHERE date = ? ORDER BY total_time_ms DESC',
    date
  );
  return rows.map((r) => ({
    date: r.date,
    packageName: r.package_name,
    appName: r.app_name,
    totalTimeMs: r.total_time_ms,
  }));
}

// ─── Activity Completions ────────────────────────────────────────────────────

export async function logActivityCompletion(
  activityId: string,
  activityLabel: string
): Promise<void> {
  const db = await getDb();
  const today = todayString();
  await db.runAsync(
    `INSERT INTO activity_completions (date, activity_id, activity_label)
     VALUES (?, ?, ?)`,
    today,
    activityId,
    activityLabel
  );
}

export async function getActivityCompletionsForDate(
  date: string
): Promise<{ activityId: string; activityLabel: string; completedAt: number }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    activity_id: string;
    activity_label: string;
    completed_at: number;
  }>(
    'SELECT activity_id, activity_label, completed_at FROM activity_completions WHERE date = ?',
    date
  );
  return rows.map((r) => ({
    activityId: r.activity_id,
    activityLabel: r.activity_label,
    completedAt: r.completed_at,
  }));
}

// ─── Streaks ─────────────────────────────────────────────────────────────────

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

export async function getStreak(): Promise<StreakData> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    current_streak: number;
    longest_streak: number;
    last_active_date: string | null;
  }>('SELECT * FROM streaks WHERE id = 1');
  return {
    currentStreak: row?.current_streak ?? 0,
    longestStreak: row?.longest_streak ?? 0,
    lastActiveDate: row?.last_active_date ?? null,
  };
}

/**
 * Call this once per day when the user has completed at least one activity.
 * Increments the streak; resets to 1 if a day was missed.
 */
export async function recordStreakDay(): Promise<StreakData> {
  const db = await getDb();
  const today = todayString();
  const streak = await getStreak();

  if (streak.lastActiveDate === today) return streak; // already recorded today

  const yesterday = yesterdayString();
  const newCurrent =
    streak.lastActiveDate === yesterday ? streak.currentStreak + 1 : 1;
  const newLongest = Math.max(streak.longestStreak, newCurrent);

  await db.runAsync(
    `UPDATE streaks SET current_streak = ?, longest_streak = ?, last_active_date = ?
     WHERE id = 1`,
    newCurrent,
    newLongest,
    today
  );

  return {
    currentStreak: newCurrent,
    longestStreak: newLongest,
    lastActiveDate: today,
  };
}

export async function removeActivityCompletion(activityId: string): Promise<void> {
  const db = await getDb();
  const today = todayString();
  await db.runAsync(
    'DELETE FROM activity_completions WHERE date = ? AND activity_id = ?',
    today,
    activityId
  );
}

// ─── Weekly chart data ────────────────────────────────────────────────────────

export async function getWeeklyUsageTotals(
  weekOffset = 0
): Promise<{ date: string; totalMs: number }[]> {
  const db = await getDb();
  const today = new Date();
  const daysSinceMonday = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysSinceMonday + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(localDateString(d));
  }

  const placeholders = dates.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{ date: string; total: number }>(
    `SELECT date, SUM(total_time_ms) as total FROM usage_snapshots WHERE date IN (${placeholders}) GROUP BY date`,
    ...dates
  );
  const map = new Map(rows.map((r) => [r.date, r.total]));
  return dates.map((date) => ({ date, totalMs: map.get(date) ?? 0 }));
}

// ─── Developer / Testing utilities ───────────────────────────────────────────

/**
 * Inserts synthetic usage data for the past `preset.sampleDays` days (excluding today).
 * Each day gets a random total between 60–130% of baselineCapMinutes, split
 * randomly across the provided apps so the chart and reduction logic have
 * realistic data to work against. Uses upsertUsageSnapshot so re-seeding is safe.
 */
export async function seedTestData(
  apps: { packageName: string; appName: string }[],
  preset: { sampleDays: number; baselineCapMinutes: number }
): Promise<void> {
  if (apps.length === 0) return;
  const baselineMs = preset.baselineCapMinutes * 60_000;

  for (let dayOffset = 1; dayOffset <= preset.sampleDays; dayOffset++) {
    const d = new Date();
    d.setDate(d.getDate() - dayOffset);
    const date = localDateString(d);

    // Random daily total: 60% – 130% of the baseline cap
    const variation = 0.6 + Math.random() * 0.7;
    const dayTotalMs = Math.round(baselineMs * variation);

    // Random weights so some apps dominate on some days
    const weights = apps.map(() => Math.random());
    const weightSum = weights.reduce((a, b) => a + b, 0);

    for (let i = 0; i < apps.length; i++) {
      const appMs = Math.round(dayTotalMs * (weights[i] / weightSum));
      if (appMs > 0) {
        await upsertUsageSnapshot({
          date,
          packageName: apps[i].packageName,
          appName: apps[i].appName,
          totalTimeMs: appMs,
        });
      }
    }
  }
}

/** Wipes all rows from usage_snapshots. Used by the dev "Clear test data" action. */
export async function clearAllUsageData(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM usage_snapshots');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayString(): string {
  return localDateString(new Date());
}

export function yesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateString(d);
}
