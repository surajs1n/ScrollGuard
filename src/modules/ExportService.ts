import * as FileSystem from 'expo-file-system';
import { Share } from 'react-native';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_INSTALL_DATE   = 'scrollguard_install_date';
const PREFS_MONITORED_APPS = 'scrollguard_monitored_apps';
const PREFS_INTENSITY      = 'scrollguard_intensity';

export interface ExportPayload {
  meta: {
    exportedAt: string;
    appVersion: string;
    intensity: string | null;
    installDate: string | null;
    monitoredApps: string[];
  };
  usageSnapshots: object[];
  activityCompletions: object[];
  streak: object | null;
}

export async function exportData(): Promise<void> {
  const db = await SQLite.openDatabaseAsync('scrollguard.db');

  const [snapshots, completions, streakRow, installDate, monitoredAppsRaw, intensity] =
    await Promise.all([
      db.getAllAsync('SELECT * FROM usage_snapshots ORDER BY date DESC'),
      db.getAllAsync('SELECT * FROM activity_completions ORDER BY date DESC'),
      db.getFirstAsync('SELECT * FROM streaks WHERE id = 1'),
      AsyncStorage.getItem(PREFS_INSTALL_DATE),
      AsyncStorage.getItem(PREFS_MONITORED_APPS),
      AsyncStorage.getItem(PREFS_INTENSITY),
    ]);

  const monitoredApps: string[] = monitoredAppsRaw ? JSON.parse(monitoredAppsRaw) : [];
  const installDateStr = installDate
    ? new Date(Number(installDate)).toISOString()
    : null;

  const payload: ExportPayload = {
    meta: {
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      intensity: intensity ?? 'balanced',
      installDate: installDateStr,
      monitoredApps,
    },
    usageSnapshots: snapshots as object[],
    activityCompletions: completions as object[],
    streak: streakRow as object | null,
  };

  const json = JSON.stringify(payload, null, 2);
  const filename = `scrollguard-export-${formatDateForFilename(new Date())}.json`;

  // Also write to cache so the user can find the file if needed
  await FileSystem.writeAsStringAsync(
    `${FileSystem.cacheDirectory}${filename}`,
    json,
    { encoding: FileSystem.EncodingType.UTF8 },
  );

  await Share.share({
    title: filename,
    message: json,
  });
}

function formatDateForFilename(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}
