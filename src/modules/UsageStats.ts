import { NativeModules, Platform } from 'react-native';

const { UsageStats: Native } = NativeModules;

export interface AppUsage {
  packageName: string;
  appName: string;
  totalTimeMs: number;
  lastTimeUsed: number;
}

export interface InstalledApp {
  packageName: string;
  appName: string;
}

export interface CuratedApp {
  packageName: string;
  appName: string;
  installed: boolean;
}

function assertAndroid(): void {
  if (Platform.OS !== 'android') {
    throw new Error('UsageStats is Android-only');
  }
}

export const UsageStats = {
  /** Returns true if the PACKAGE_USAGE_STATS permission has been granted. */
  hasPermission(): Promise<boolean> {
    assertAndroid();
    return Native.hasPermission();
  },

  /** Opens the Usage Access settings screen so the user can grant permission. */
  openPermissionSettings(): Promise<boolean> {
    assertAndroid();
    return Native.openPermissionSettings();
  },

  /**
   * Returns usage data for all monitored apps (Instagram, YouTube, etc.)
   * for the given time range.
   */
  getMonitoredAppsUsage(startTime: number, endTime: number): Promise<AppUsage[]> {
    assertAndroid();
    return Native.getMonitoredAppsUsage(startTime, endTime);
  },

  /** Returns monitored apps that are actually installed on this device. */
  getInstalledMonitoredApps(): Promise<InstalledApp[]> {
    assertAndroid();
    return Native.getInstalledMonitoredApps();
  },

  /** Returns the full curated app list with installed status for each. */
  getCuratedAppsWithStatus(): Promise<CuratedApp[]> {
    assertAndroid();
    return Native.getCuratedAppsWithStatus();
  },

  /**
   * Returns all user-installed apps NOT in the curated list.
   * Excludes system apps and apps without a launcher icon.
   */
  getInstalledUserApps(): Promise<InstalledApp[]> {
    assertAndroid();
    if (typeof Native.getInstalledUserApps !== 'function') return Promise.resolve([]);
    return Native.getInstalledUserApps();
  },

  /** Convenience: returns usage for today (midnight → now). */
  getTodayUsage(): Promise<AppUsage[]> {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return UsageStats.getMonitoredAppsUsage(todayStart.getTime(), now);
  },

  /** Convenience: returns usage for yesterday. */
  getYesterdayUsage(): Promise<AppUsage[]> {
    const now = new Date();
    const yesterdayEnd = new Date(now);
    yesterdayEnd.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(yesterdayEnd);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    return UsageStats.getMonitoredAppsUsage(
      yesterdayStart.getTime(),
      yesterdayEnd.getTime()
    );
  },
};
