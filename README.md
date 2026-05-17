# ScrollGuard

An Android digital wellbeing companion app. Not a blocker — a companion. It earns the user's trust first by observing silently, then nudges gently, and finally redirects attention toward offline activities. Built with React Native + Expo bare workflow.

> **Product vision, personas, GTM, and success metrics:** [`docs/PRD.md`](docs/PRD.md)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.74 + Expo SDK 51 (bare workflow) |
| Language | TypeScript (JS layer) + Kotlin (native modules) |
| Android min SDK | 26 (Android 8.0) |
| Android compile SDK | 34 (hard constraint — expo-modules-core 1.x fails on API 36) |
| Local storage | expo-sqlite v14 (async API) for usage data; AsyncStorage for preferences |
| Navigation | @react-navigation/native-stack |
| Build toolchain | Gradle 8.8 + JDK 21 (Android Studio JDK — not Homebrew) |

---

## Prerequisites

```bash
# Required
node >= 18
Android Studio (with Android SDK 34 installed)
Java 21 — must point to Android Studio's JDK, not Homebrew
watchman           # prevents EMFILE errors on macOS

# Environment variable (add to ~/.zshrc or ~/.bash_profile)
export JAVA_HOME=/Applications/Android\ Studio.app/Contents/jbr/Contents/Home
```

---

## Setup

```bash
git clone https://github.com/surajs1n/ScrollGuard.git
cd ScrollGuard
npm install
```

---

## Running

```bash
# Start Metro bundler
npx react-native start

# In a second terminal — build and install on connected device / emulator
npx react-native run-android
```

> The app only runs on Android. There is no iOS build.

---

## Building a Release APK

```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

The release keystore (`scrollguard-release.jks`) is in `android/app/`. Password is stored in `android/app/build.gradle` under `signingConfigs.release`.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   React Native JS Layer              │
│                                                     │
│  src/screens/          src/modules/                 │
│  ├─ onboarding/        ├─ UsageStats.ts  ──────────►│─┐
│  ├─ dashboard/         ├─ MonitorService.ts          │ │ NativeModules bridge
│  └─ settings/          ├─ Overlay.ts    ──────────►│─┤
│                         └─ ExportService.ts          │ │
│  src/storage/db.ts  (SQLite)                        │ │
│  src/config/intensityPresets.ts                     │ │
└─────────────────────────────────────────────────────┘ │
                                                        │
┌─────────────────────────────────────────────────────┐ │
│              Kotlin Native Modules                   │◄┘
│                                                     │
│  usagestats/UsageStatsModule.kt                     │
│    - hasPermission / openPermissionSettings         │
│    - queryUsageStats / getMonitoredAppsUsage        │
│    - getCuratedAppsWithStatus                       │
│    - getInstalledUserApps                           │
│    - setMonitorPrefs (writes SharedPreferences)     │
│                                                     │
│  overlay/OverlayModule.kt                           │
│    - hasOverlayPermission                           │
│    - requestOverlayPermission                       │
│    - showNudge / hideNudge                          │
│                                                     │
│  service/UsageMonitorService.kt  (foreground svc)   │
│    - polls every 60s                                │
│    - reads config from SharedPreferences            │
│    - triggers overlay nudge via NudgeOverlayService │
│                                                     │
│  overlay/ScrollGuardAccessibilityService.kt         │
│    - detects foreground app changes                 │
│    - notifies UsageMonitorService                   │
│                                                     │
│  service/BootReceiver.kt                            │
│    - restarts UsageMonitorService after reboot      │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
            SharedPreferences (scrollguard_prefs)
            SQLite (scrollguard.db via expo-sqlite)
            AsyncStorage (user preferences)
```

---

## Module Map

### JS Modules (`src/modules/`)

| File | Responsibility |
|---|---|
| `UsageStats.ts` | Bridge to `UsageStatsModule.kt`. All usage data queries, curated + installed app lists |
| `MonitorService.ts` | Manages monitored apps + intensity in AsyncStorage; writes resolved preset values to native SharedPreferences via `UsageStats.setMonitorPrefs` |
| `Overlay.ts` | Bridge to `OverlayModule.kt`. Permission checks and nudge overlay control |
| `ExportService.ts` | Reads SQLite + AsyncStorage, serialises to JSON, triggers share sheet via RN `Share` API |

### Config (`src/config/`)

| File | Responsibility |
|---|---|
| `intensityPresets.ts` | **Single source of truth** for all intensity parameters (Gentle / Balanced / Strict). Also contains the phase-aware banner message matrix (`INTENSITY_MESSAGES`) and `getBannerPhase()`. Change a value here and it flows through the entire app automatically |

### Storage (`src/storage/`)

| File | Responsibility |
|---|---|
| `db.ts` | SQLite schema + all async query functions: usage snapshots, activity completions, streaks, weekly chart data |

### Screens (`src/screens/`)

| Screen | Route | Purpose |
|---|---|---|
| `WelcomeScreen` | `Welcome` | Onboarding entry |
| `PermissionUsageStatsScreen` | `PermissionUsageStats` | Step 1 of 3 — PACKAGE_USAGE_STATS |
| `PermissionOverlayScreen` | `PermissionOverlay` | Step 2 of 3 — SYSTEM_ALERT_WINDOW |
| `AppSelectionScreen` | `AppSelection` | Step 3 of 3 — pick apps to monitor (curated + device) |
| `IntensitySelectionScreen` | `IntensitySelection` | Step 4 — choose Gentle / Balanced / Strict |
| `DashboardScreen` | `Dashboard` | Home screen — weekly chart, usage breakdown, suggestions |
| `SettingsScreen` | `Settings` | Hub: Monitored Apps / Improvement Pace / Export |
| `MonitoredAppsScreen` | `MonitoredApps` | Edit monitored apps post-onboarding |
| `IntensitySettingsScreen` | `IntensitySettings` | Edit intensity preset post-onboarding |

---

## Data Flow

```
User opens app
     │
     ▼
App.tsx reads AsyncStorage for onboarding completion flag
     │
     ├─ Not completed → WelcomeScreen (onboarding flow)
     │
     └─ Completed → DashboardScreen
                         │
                         ▼
              loadData() on every focus + AppState 'active'
                         │
              ┌──────────┼──────────────┐
              │          │              │
              ▼          ▼              ▼
        UsageStats   getStreak()   getWeeklyUsageTotals()
        .getTodayUsage()  (SQLite)     (SQLite)
        (→ Kotlin UsageStatsManager)
              │
              ▼
        upsertUsageSnapshot() → SQLite (persists today's data)
```

### Intensity config flow (JS → Native)

```
User selects intensity in IntensitySelectionScreen or IntensitySettingsScreen
     │
     ▼
MonitorService.setIntensity(level)
     │
     ├─ Saves level string to AsyncStorage
     │
     └─ Calls UsageStats.setMonitorPrefs(installDate, packages, intensity,
              sampleDays, weeklyReductionPct, nudgeBufferPct,
              frictionType, cooldownMinutes, baselineCapMinutes, floorMinutes)
                    │
                    ▼
            UsageStatsModule.kt writes resolved numbers to SharedPreferences
                    │
                    ▼
            UsageMonitorService.kt reads SharedPreferences each polling cycle
            (no knowledge of preset names — only concrete numbers)
```

---

## SQLite Schema

```sql
-- Per-app daily usage (upserted on every dashboard load)
CREATE TABLE usage_snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT NOT NULL,        -- YYYY-MM-DD
  package_name  TEXT NOT NULL,
  app_name      TEXT NOT NULL,
  total_time_ms INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX idx_usage_date_pkg ON usage_snapshots(date, package_name);

-- "I did it" log — one row per activity completion
CREATE TABLE activity_completions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  date           TEXT NOT NULL,
  activity_id    TEXT NOT NULL,
  activity_label TEXT NOT NULL,
  completed_at   INTEGER NOT NULL
);

-- Single-row streak tracker
CREATE TABLE streaks (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  current_streak   INTEGER NOT NULL DEFAULT 0,
  longest_streak   INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT
);
```

---

## Key Architectural Constraints

- **`compileSdk = 34` is a hard ceiling.** `expo-modules-core` 1.x has a Kotlin null-safety bug on API 36. Do not bump until Expo SDK 52+.
- **JDK 21 required.** Gradle 8.8 supports up to Java 22. Homebrew Java 24 will break the build. Always use the JDK bundled with Android Studio.
- **`registerRootComponent` registers as `"main"`.** `MainActivity.getMainComponentName()` must return `"main"` to match.
- **No new native libraries without a fresh APK build.** Any package with a Kotlin/Java component requires `npx react-native run-android` or a new APK — hot reload is not enough.
- **Android 11+ package visibility.** Any app package you want to query via `PackageManager` must be declared in the `<queries>` block in `AndroidManifest.xml`, or you'll get false "not installed" results.
- **`QUERY_ALL_PACKAGES` is not used.** `getInstalledUserApps()` relies on launcher-intent filtering instead. Covers ~95% of real user apps without the Play Store policy restriction.
- **No backend in V1.** All data is on-device. SQLite + AsyncStorage + SharedPreferences. No Firebase, no server, no account.

---

## AsyncStorage Keys

| Key | Value | Set by |
|---|---|---|
| `scrollguard_install_date` | Unix timestamp (ms) as string | `MonitorService.init()` |
| `scrollguard_monitored_apps` | JSON array of package name strings | `MonitorService.init()` / `updateMonitoredApps()` |
| `scrollguard_intensity` | `'gentle'` \| `'balanced'` \| `'strict'` | `MonitorService.setIntensity()` |
| `scrollguard_onboarding_done` | `'true'` | `IntensitySelectionScreen` on completion |

---

## SharedPreferences Keys (`scrollguard_prefs`)

Written by `UsageStatsModule.setMonitorPrefs()`, read by `UsageMonitorService.kt`:

`installDate`, `monitoredApps` (StringSet), `intensity`, `sampleDays`, `weeklyReductionPct`, `nudgeBufferPct`, `frictionType`, `cooldownMinutes`, `baselineCapMinutes`, `floorMinutes`

---

## Adding a New Screen

1. Create `src/screens/<section>/YourScreen.tsx`
2. Add the route to `RootStackParamList` in `src/navigation/AppNavigator.tsx`
3. Add `<Stack.Screen name="YourScreen" component={YourScreen} />` to the navigator
4. Navigate with `navigation.navigate('YourScreen')`

## Adding a New Intensity Preset

Edit only `src/config/intensityPresets.ts`:
1. Add the new level to `IntensityLevel` type
2. Add the preset object to `INTENSITY_PRESETS`
3. Add the banner messages to `INTENSITY_MESSAGES`
4. All screens, banners, and native config writes update automatically

---

## Permissions

| Permission | Why |
|---|---|
| `PACKAGE_USAGE_STATS` | Per-app screen time via `UsageStatsManager`. Must be granted manually in Settings |
| `SYSTEM_ALERT_WINDOW` | Draw nudge overlay on top of other apps |
| `BIND_ACCESSIBILITY_SERVICE` | Detect foreground app changes |
| `FOREGROUND_SERVICE` | Keep `UsageMonitorService` alive in background |
| `RECEIVE_BOOT_COMPLETED` | Restart service after device reboot |
