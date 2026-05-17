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

const _iconCache = new Map<string, string>();

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

  /**
   * Returns the app icon as a Base64 PNG string for use in
   * <Image source={{ uri: `data:image/png;base64,${b64}` }} />.
   * Returns empty string if the icon can't be loaded.
   * Results are cached in-memory so repeated calls for the same package are free.
   */
  getAppIcon(packageName: string): Promise<string> {
    assertAndroid();
    const cached = _iconCache.get(packageName);
    if (cached !== undefined) return Promise.resolve(cached);
    if (typeof Native.getAppIcon !== 'function') return Promise.resolve('');
    return Native.getAppIcon(packageName).then((b64: string) => {
      _iconCache.set(packageName, b64);
      return b64;
    });
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
