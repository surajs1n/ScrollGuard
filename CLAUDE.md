# ScrollGuard — Claude Instructions

## Git workflow rules

- **Never commit automatically.** Only commit when the user explicitly says "git commit" or equivalent.
- **Never push automatically.** Only push when the user explicitly says "git push" or equivalent.
- When committing, always include Claude as co-author:
  ```
  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  ```
- All changes go to branch `claude/eloquent-greider-3f5c08` and land on **PR #2** until the user says otherwise.
- After making code changes, stop and let the user review. Do not stage, commit, or push unless asked.

---

## Project overview

ScrollGuard is an Android digital wellbeing companion app. It is not a blocker — it earns trust by observing silently, then nudges gently, and finally redirects attention to offline activities.

- **PRD (product vision, personas, GTM, success metrics):** `docs/PRD.md`
- **Technical reference (setup, architecture, schema, module map):** `README.md`
- **This file:** AI handoff context and session rules

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.74 + Expo SDK 51 (bare workflow) |
| Language | TypeScript (JS layer) + Kotlin (native modules) |
| Android min SDK | 26 (Android 8.0) |
| Android compile SDK | **34 — hard ceiling** (expo-modules-core 1.x breaks on API 36) |
| Local storage | expo-sqlite v14 (async API) for usage data; AsyncStorage for preferences |
| Navigation | @react-navigation/native-stack |
| Build toolchain | Gradle 8.8 + **JDK 21** (Android Studio JDK — Homebrew Java 24 will break the build) |

---

## Hard constraints — never violate these

1. **`compileSdk = 34` is a ceiling.** Do not bump to 35/36 until Expo SDK 52+.
2. **JDK 21 required.** `JAVA_HOME` must point to Android Studio's bundled JDK, not Homebrew. Homebrew Java 24 causes Gradle failures.
3. **No new native libraries without a fresh APK.** Any package with Kotlin/Java native code requires `npx react-native run-android` to compile in — hot reload is not enough. JS-only packages (no native code) work immediately.
4. **Native method guard pattern.** When calling a native module method that may not exist on an older APK:
   ```typescript
   if (typeof Native.methodName !== 'function') return Promise.resolve(fallback);
   return Native.methodName(...args);
   ```
   `.catch(() => fallback)` does NOT work — it only catches promise rejections, not synchronous TypeError when the method is undefined.
5. **`registerRootComponent` registers as `"main"`.** `MainActivity.getMainComponentName()` must return `"main"`.
6. **Android 11+ package visibility.** Every package queried via `PackageManager` must be in the `<queries>` block in `AndroidManifest.xml`.
7. **No `QUERY_ALL_PACKAGES`.** Use launcher-intent filtering instead (`pm.getLaunchIntentForPackage(pkg) != null`). This covers ~95% of user apps without Play Store policy issues.
8. **No backend in V1.** All data is on-device. SQLite + AsyncStorage + SharedPreferences. No Firebase, no account, no server.
9. **No react-native-svg.** The library was removed after it caused `RNSVGPath was not found in UIManager` crashes. The weekly chart is a pure React Native bar chart (View/TouchableOpacity). Do not re-introduce SVG.
10. **No 5-app monitoring cap.** There is no limit on how many apps a user can monitor. Do not add one.

---

## Key architectural decisions

### Intensity presets — single source of truth
`src/config/intensityPresets.ts` is the **only** place intensity parameters live. Changing a value there propagates automatically to:
- All UI screens (IntensitySelectionScreen, IntensitySettingsScreen, SettingsScreen sublabel)
- Banner messages (computed via functions at render time — never hardcoded strings)
- Native SharedPreferences (written by `MonitorService.setIntensity()` → `UsageStats.setMonitorPrefs()`)
- `UsageMonitorService.kt` (reads resolved numbers — has no knowledge of preset names)

### Phase-aware banner
`getBannerPhase(daysSinceInstall, currentWeek, preset)` returns `'observer' | 'active' | 'progress' | 'maintenance'`.
`INTENSITY_MESSAGES[intensity][phase].title(preset, week)` and `.body(preset, week)` produce the banner copy.
All numbers in messages are functions of `IntensityPreset` — never hardcoded. If a preset value changes, messages update automatically.

### App list discovery
User-installed apps (non-curated) are discovered via `PackageManager.getInstalledApplications(0)` filtered by:
- Not `FLAG_SYSTEM`
- Has launcher intent
- Not our own package
- Not already in `CURATED_APPS`

The native method is `getInstalledUserApps()` in `UsageStatsModule.kt`. The JS bridge is `UsageStats.getInstalledUserApps()` in `src/modules/UsageStats.ts`.

### App selection screens (onboarding + settings)
Both `AppSelectionScreen` and `MonitoredAppsScreen` use:
- `SectionList` with two sections: "Popular apps" (curated) + "Other apps on your device" (user-installed)
- Live `TextInput` search filter
- Sort: installed curated apps alphabetically first, then uninstalled curated apps alphabetically; user-installed apps sorted alphabetically
- Inset card panel style (`borderRadius: 12, borderWidth: 1`) for the list

### Weekly chart
Pure React Native bar chart in `DashboardScreen` using `View` and `TouchableOpacity`. No SVG, no native dependencies. Supports week navigation (`chartWeekOffset` state). "Current week" pill appears only when offset < 0. Arrow buttons are fixed-width (`width: 28`) so their positions don't shift with date text length.

### Refresh strategy
Dashboard uses both `useFocusEffect` (tab/screen focus) and `AppState.addEventListener('change')` → `'active'` (task-switcher return). Both call the same `loadData()`.

---

## Module map (key files)

### JS modules (`src/modules/`)
| File | What it does |
|---|---|
| `UsageStats.ts` | Bridge to `UsageStatsModule.kt` — all usage queries, curated/installed app lists, `setMonitorPrefs` |
| `MonitorService.ts` | Manages monitored apps + intensity in AsyncStorage; writes resolved preset values to native SharedPreferences |
| `Overlay.ts` | Bridge to `OverlayModule.kt` — permission checks and nudge overlay control |
| `ExportService.ts` | Reads SQLite + AsyncStorage, serialises to JSON, triggers share sheet |

### Config (`src/config/`)
| File | What it does |
|---|---|
| `intensityPresets.ts` | **Single source of truth** for all intensity parameters, banner messages, and `getBannerPhase()` |

### Storage (`src/storage/`)
| File | What it does |
|---|---|
| `db.ts` | SQLite schema + async query functions: usage snapshots, activity completions, streaks, weekly chart data |

### Screens (`src/screens/`)
| Screen | Route | Purpose |
|---|---|---|
| `WelcomeScreen` | `Welcome` | Onboarding entry |
| `PermissionUsageStatsScreen` | `PermissionUsageStats` | Onboarding step 1 — PACKAGE_USAGE_STATS |
| `PermissionOverlayScreen` | `PermissionOverlay` | Onboarding step 2 — SYSTEM_ALERT_WINDOW |
| `AppSelectionScreen` | `AppSelection` | Onboarding step 3 — pick apps (curated + device, search) |
| `IntensitySelectionScreen` | `IntensitySelection` | Onboarding step 4 — choose Gentle / Balanced / Strict |
| `DashboardScreen` | `Dashboard` | Home — weekly bar chart, usage breakdown, phase banner, activity suggestions |
| `SettingsScreen` | `Settings` | Hub: 3 rows → Monitored Apps / Improvement Pace / Export |
| `MonitoredAppsScreen` | `MonitoredApps` | Edit monitored apps post-onboarding (SectionList + search) |
| `IntensitySettingsScreen` | `IntensitySettings` | Edit intensity preset post-onboarding |

### Navigation
`src/navigation/AppNavigator.tsx` — all routes are in `RootStackParamList`. Adding a screen: add to the type, add `<Stack.Screen>`, navigate with `navigation.navigate('RouteName')`.

### Kotlin native modules (`android/app/src/main/java/com/scrollguard/`)
| File | What it does |
|---|---|
| `usagestats/UsageStatsModule.kt` | Usage queries, curated/installed app lists, `setMonitorPrefs` → SharedPreferences |
| `overlay/OverlayModule.kt` | Overlay permission checks, `showNudge` / `hideNudge` |
| `service/UsageMonitorService.kt` | Foreground service, polls every 60s, reads SharedPreferences, triggers nudge |
| `overlay/ScrollGuardAccessibilityService.kt` | Detects foreground app changes, notifies `UsageMonitorService` |
| `service/BootReceiver.kt` | Restarts `UsageMonitorService` after device reboot |

---

## What is built (V1)

- Full onboarding flow (welcome → permissions × 2 → app selection → intensity)
- Dashboard: weekly bar chart (week navigation), today's usage breakdown, streak card, activity suggestions with "I did it" + undo, phase-aware banner
- Settings hub: monitored apps editor, intensity editor, data export
- Native usage stats module (foreground time per app, curated + user-installed app discovery)
- Native overlay module (nudge overlay draw-over-apps)
- Native foreground service (60s polling, SharedPreferences-driven config)
- Accessibility service (foreground app detection)
- Boot receiver (service restart after reboot)
- SQLite schema: `usage_snapshots`, `activity_completions`, `streaks`
- Phase-aware intensity banner (observer / active / progress / maintenance)
- Intensity preset system: Gentle / Balanced / Strict

## What is NOT built (V1 exclusions)

- No iOS support
- No backend, cloud sync, or user accounts
- No push notifications
- No social/sharing features
- No onboarding analytics
- No A/B testing
- No in-app purchase or subscription gate
- No accessibility service auto-start UI (user must enable in device settings)

---

## SQLite schema

```sql
CREATE TABLE usage_snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT NOT NULL,        -- YYYY-MM-DD
  package_name  TEXT NOT NULL,
  app_name      TEXT NOT NULL,
  total_time_ms INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX idx_usage_date_pkg ON usage_snapshots(date, package_name);

CREATE TABLE activity_completions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  date           TEXT NOT NULL,
  activity_id    TEXT NOT NULL,
  activity_label TEXT NOT NULL,
  completed_at   INTEGER NOT NULL
);

CREATE TABLE streaks (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  current_streak   INTEGER NOT NULL DEFAULT 0,
  longest_streak   INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT
);
```

---

## AsyncStorage keys

| Key | Value | Set by |
|---|---|---|
| `scrollguard_install_date` | Unix timestamp (ms) as string | `MonitorService.init()` |
| `scrollguard_monitored_apps` | JSON array of package name strings | `MonitorService.init()` / `updateMonitoredApps()` |
| `scrollguard_intensity` | `'gentle'` \| `'balanced'` \| `'strict'` | `MonitorService.setIntensity()` |
| `scrollguard_onboarding_done` | `'true'` | `IntensitySelectionScreen` on completion |

## SharedPreferences keys (`scrollguard_prefs`)

Written by `UsageStatsModule.setMonitorPrefs()`, read by `UsageMonitorService.kt`:

`installDate`, `monitoredApps` (StringSet), `intensity`, `sampleDays`, `weeklyReductionPct`, `nudgeBufferPct`, `frictionType`, `cooldownMinutes`, `baselineCapMinutes`, `floorMinutes`

---

## Common tasks

### Add a new screen
1. Create `src/screens/<section>/YourScreen.tsx`
2. Add route to `RootStackParamList` in `src/navigation/AppNavigator.tsx`
3. Add `<Stack.Screen name="YourScreen" component={YourScreen} />` to the navigator
4. Navigate with `navigation.navigate('YourScreen')`

### Add a new intensity preset
Edit only `src/config/intensityPresets.ts`:
1. Add the new level to `IntensityLevel` type
2. Add a preset object to `INTENSITY_PRESETS`
3. Add banner messages to `INTENSITY_MESSAGES`
4. Everything else (screens, native config writes, phase logic) updates automatically

### Add a new native module method
1. Add `@ReactMethod fun yourMethod(...)` to the relevant `.kt` file
2. Add the JS bridge method to the corresponding `src/modules/*.ts`
3. Use the `typeof Native.yourMethod !== 'function'` guard in JS for backwards compatibility with old APKs
4. Build a new APK: `npx react-native run-android`

---

## Build commands

```bash
# Dev (Metro + Android)
npx react-native start
npx react-native run-android   # second terminal

# Release APK
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

Prerequisites: `JAVA_HOME` must point to Android Studio's JDK (not Homebrew). Android SDK 34 must be installed.
