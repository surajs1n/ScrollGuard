import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  INTENSITY_PRESETS,
  DEFAULT_INTENSITY,
  IntensityLevel,
} from '../config/intensityPresets';

const { UsageStats } = NativeModules;

const PREFS_INSTALL_DATE     = 'scrollguard_install_date';
const PREFS_MONITORED_APPS   = 'scrollguard_monitored_apps';
const PREFS_INTENSITY        = 'scrollguard_intensity';

export const MonitorService = {
  /**
   * Called at the end of onboarding (app selection step).
   * Persists install date + monitored apps. Intensity is written separately
   * by setIntensity(), called from IntensitySelectionScreen.
   */
  async init(monitoredPackages: string[]): Promise<void> {
    const now = Date.now().toString();
    await AsyncStorage.multiSet([
      [PREFS_INSTALL_DATE, now],
      [PREFS_MONITORED_APPS, JSON.stringify(monitoredPackages)],
    ]);
    if (Platform.OS === 'android') {
      const intensity = await MonitorService.getIntensity();
      await writeNativePrefs(Number(now), monitoredPackages, intensity);
    }
  },

  async updateMonitoredApps(monitoredPackages: string[]): Promise<void> {
    await AsyncStorage.setItem(PREFS_MONITORED_APPS, JSON.stringify(monitoredPackages));
    if (Platform.OS === 'android') {
      const [installDate, intensity] = await Promise.all([
        MonitorService.getInstallDate(),
        MonitorService.getIntensity(),
      ]);
      await writeNativePrefs(installDate ?? Date.now(), monitoredPackages, intensity);
    }
  },

  async setIntensity(level: IntensityLevel): Promise<void> {
    await AsyncStorage.setItem(PREFS_INTENSITY, level);
    if (Platform.OS === 'android') {
      const [installDate, monitoredApps] = await Promise.all([
        MonitorService.getInstallDate(),
        MonitorService.getMonitoredApps(),
      ]);
      await writeNativePrefs(installDate ?? Date.now(), monitoredApps, level);
    }
  },

  async getIntensity(): Promise<IntensityLevel> {
    const val = await AsyncStorage.getItem(PREFS_INTENSITY);
    return (val as IntensityLevel | null) ?? DEFAULT_INTENSITY;
  },

  async getInstallDate(): Promise<number | null> {
    const val = await AsyncStorage.getItem(PREFS_INSTALL_DATE);
    return val ? Number(val) : null;
  },

  async getMonitoredApps(): Promise<string[]> {
    const val = await AsyncStorage.getItem(PREFS_MONITORED_APPS);
    return val ? JSON.parse(val) : [];
  },

  async getCurrentWeek(): Promise<number> {
    const installDate = await MonitorService.getInstallDate();
    if (!installDate) return 1;
    const daysSince = Math.floor((Date.now() - installDate) / 86_400_000);
    return Math.floor(daysSince / 7) + 1;
  },
};

/**
 * Writes all resolved preset numbers to SharedPreferences.
 * The native service reads concrete numbers only — it has no knowledge of preset names.
 * Changing intensityPresets.ts automatically flows through here.
 */
async function writeNativePrefs(
  installDate: number,
  monitoredPackages: string[],
  intensity: IntensityLevel,
): Promise<void> {
  try {
    const preset = INTENSITY_PRESETS[intensity];
    if (UsageStats?.setMonitorPrefs) {
      await UsageStats.setMonitorPrefs(
        installDate,
        monitoredPackages,
        intensity,
        preset.sampleDays,
        preset.weeklyReductionPct,
        preset.nudgeBufferPct,
        preset.frictionType,
        preset.cooldownMinutes,
        preset.baselineCapMinutes,
        preset.floorMinutes,
      );
    }
  } catch {
    // Non-fatal
  }
}
