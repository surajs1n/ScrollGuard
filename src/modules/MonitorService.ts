import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { UsageStats } = NativeModules;

const PREFS_INSTALL_DATE = 'scrollguard_install_date';
const PREFS_MONITORED_APPS = 'scrollguard_monitored_apps';

export const MonitorService = {
  /**
   * Records the install date and chosen monitored apps into AsyncStorage
   * AND into the Android SharedPreferences used by UsageMonitorService.
   * Call this at the end of onboarding.
   */
  async init(monitoredPackages: string[]): Promise<void> {
    const now = Date.now().toString();
    await AsyncStorage.multiSet([
      [PREFS_INSTALL_DATE, now],
      [PREFS_MONITORED_APPS, JSON.stringify(monitoredPackages)],
    ]);
    // Write to Android SharedPreferences so the native service can read them
    if (Platform.OS === 'android') {
      await writeNativePrefs(Number(now), monitoredPackages);
    }
  },

  async getInstallDate(): Promise<number | null> {
    const val = await AsyncStorage.getItem(PREFS_INSTALL_DATE);
    return val ? Number(val) : null;
  },

  async getMonitoredApps(): Promise<string[]> {
    const val = await AsyncStorage.getItem(PREFS_MONITORED_APPS);
    return val ? JSON.parse(val) : [];
  },

  /** Day 0 = install day. Week 1 = days 0–6, Week 2 = days 7–13, etc. */
  async getCurrentWeek(): Promise<number> {
    const installDate = await MonitorService.getInstallDate();
    if (!installDate) return 1;
    const daysSince = Math.floor((Date.now() - installDate) / 86_400_000);
    return Math.floor(daysSince / 7) + 1;
  },
};

// Writes prefs that UsageMonitorService reads (native SharedPreferences bridge).
// In V1 this is a simple approach: we write via a native module call that updates
// the "scrollguard_prefs" SharedPreferences file the Kotlin service reads.
async function writeNativePrefs(
  installDate: number,
  monitoredPackages: string[]
): Promise<void> {
  try {
    // UsageStats module exposes a setPrefs method for this purpose
    if (UsageStats?.setMonitorPrefs) {
      await UsageStats.setMonitorPrefs(installDate, monitoredPackages);
    }
  } catch {
    // Non-fatal: service will function with defaults
  }
}
