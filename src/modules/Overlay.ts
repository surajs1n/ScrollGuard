import { NativeModules, Platform } from 'react-native';

const { Overlay: Native } = NativeModules;

function assertAndroid(): void {
  if (Platform.OS !== 'android') {
    throw new Error('Overlay is Android-only');
  }
}

export const Overlay = {
  /** Returns true if SYSTEM_ALERT_WINDOW permission is granted. */
  hasOverlayPermission(): Promise<boolean> {
    assertAndroid();
    return Native.hasOverlayPermission();
  },

  /** Opens the Manage Overlay Permission settings screen. */
  requestOverlayPermission(): Promise<boolean> {
    assertAndroid();
    return Native.requestOverlayPermission();
  },

  /**
   * Draws a nudge card on top of the current foreground app.
   * Requires SYSTEM_ALERT_WINDOW permission.
   */
  showNudge(appName: string, minutesUsed: number, message: string): Promise<boolean> {
    assertAndroid();
    return Native.showNudge(appName, minutesUsed, message);
  },

  /** Removes the nudge card if visible. */
  dismissNudge(): Promise<boolean> {
    assertAndroid();
    return Native.dismissNudge();
  },
};
