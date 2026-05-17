package com.scrollguard.usagestats

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ResolveInfo
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Base64
import java.io.ByteArrayOutputStream
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = UsageStatsModule.NAME)
class UsageStatsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "UsageStats"

        // Curated list of commonly addictive apps
        val CURATED_APPS = listOf(
            Pair("com.instagram.android",      "Instagram"),
            Pair("com.google.android.youtube", "YouTube"),
            Pair("com.zhiliaoapp.musically",   "TikTok"),
            Pair("com.reddit.frontpage",       "Reddit"),
            Pair("com.twitter.android",        "X (Twitter)"),
            Pair("com.facebook.katana",        "Facebook"),
            Pair("com.snapchat.android",       "Snapchat"),
            Pair("com.linkedin.android",       "LinkedIn"),
            Pair("com.whatsapp",               "WhatsApp"),
            Pair("com.pinterest",              "Pinterest"),
            Pair("com.tumblr",                 "Tumblr"),
            Pair("tv.twitch.android.app",      "Twitch"),
        )

        val MONITORED_PACKAGES = CURATED_APPS.map { it.first }
    }

    override fun getName() = NAME

    @ReactMethod
    fun hasPermission(promise: Promise) {
        val appOps = reactApplicationContext
            .getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactApplicationContext.packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactApplicationContext.packageName
            )
        }
        promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
    }

    @ReactMethod
    fun openPermissionSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SETTINGS_OPEN_FAILED", e.message)
        }
    }

    /**
     * Returns per-app foreground time for the given time range.
     * startTime and endTime are Unix timestamps in milliseconds.
     */
    @ReactMethod
    fun queryUsageStats(startTime: Double, endTime: Double, promise: Promise) {
        try {
            val usm = reactApplicationContext
                .getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

            val stats: List<UsageStats> = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_BEST,
                startTime.toLong(),
                endTime.toLong()
            ) ?: emptyList()

            val result = WritableNativeArray()
            stats.forEach { stat ->
                if (stat.totalTimeInForeground > 0L) {
                    val map = WritableNativeMap().apply {
                        putString("packageName", stat.packageName)
                        putDouble("totalTimeMs", stat.totalTimeInForeground.toDouble())
                        putDouble("lastTimeUsed", stat.lastTimeUsed.toDouble())
                    }
                    result.pushMap(map)
                }
            }
            promise.resolve(result)
        } catch (e: SecurityException) {
            promise.reject("NO_PERMISSION", "Usage access permission not granted")
        } catch (e: Exception) {
            promise.reject("QUERY_FAILED", e.message)
        }
    }

    /**
     * Returns foreground time for monitored apps within [startTime, endTime].
     *
     * Uses queryEvents (individual RESUMED/PAUSED events with exact timestamps)
     * instead of queryUsageStats. This avoids the UTC-bucket boundary problem:
     * queryUsageStats returns daily buckets aligned to UTC midnight, so for UTC+
     * timezones the "today" bucket may include yesterday's sessions whose bucket
     * spans across local midnight. With queryEvents we accumulate only the time
     * that falls strictly inside the requested window.
     *
     * Edge case handled: if an app was already in the foreground at startTime
     * (e.g. still open from the night before), we count from startTime rather
     * than missing that session entirely.
     */
    @ReactMethod
    fun getMonitoredAppsUsage(startTime: Double, endTime: Double, promise: Promise) {
        try {
            val usm = reactApplicationContext
                .getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

            val events = usm.queryEvents(startTime.toLong(), endTime.toLong())
            val foregroundStart = mutableMapOf<String, Long>()
            val totalTime = mutableMapOf<String, Long>()
            val lastUsed = mutableMapOf<String, Long>()

            val event = UsageEvents.Event()
            @Suppress("DEPRECATION")
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                val pkg = event.packageName
                if (pkg !in MONITORED_PACKAGES) continue

                @Suppress("DEPRECATION")
                when (event.eventType) {
                    UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                        foregroundStart[pkg] = event.timeStamp
                        lastUsed[pkg] = maxOf(lastUsed[pkg] ?: 0L, event.timeStamp)
                    }
                    UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                        // If no FOREGROUND event was seen, the app was open before startTime;
                        // count from startTime so we don't miss that session.
                        val start = foregroundStart[pkg] ?: startTime.toLong()
                        val duration = event.timeStamp - start
                        if (duration > 0) {
                            totalTime[pkg] = (totalTime[pkg] ?: 0L) + duration
                        }
                        lastUsed[pkg] = maxOf(lastUsed[pkg] ?: 0L, event.timeStamp)
                        foregroundStart.remove(pkg)
                    }
                }
            }

            // Apps still in the foreground at the end of the query window
            foregroundStart.forEach { (pkg, start) ->
                val duration = endTime.toLong() - start
                if (duration > 0) {
                    totalTime[pkg] = (totalTime[pkg] ?: 0L) + duration
                }
                lastUsed[pkg] = maxOf(lastUsed[pkg] ?: 0L, endTime.toLong())
            }

            val pm: PackageManager = reactApplicationContext.packageManager
            val result = WritableNativeArray()
            totalTime.forEach { (pkg, total) ->
                if (total > 0) {
                    val appName = try {
                        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
                    } catch (e: PackageManager.NameNotFoundException) { pkg }
                    val map = WritableNativeMap().apply {
                        putString("packageName", pkg)
                        putString("appName", appName)
                        putDouble("totalTimeMs", total.toDouble())
                        putDouble("lastTimeUsed", (lastUsed[pkg] ?: 0L).toDouble())
                    }
                    result.pushMap(map)
                }
            }
            promise.resolve(result)
        } catch (e: SecurityException) {
            promise.reject("NO_PERMISSION", "Usage access permission not granted")
        } catch (e: Exception) {
            promise.reject("QUERY_FAILED", e.message)
        }
    }

    /**
     * Returns the full curated app list, each entry marked installed: true/false.
     * Used by the Settings screen and onboarding Step 3.
     */
    @ReactMethod
    fun getCuratedAppsWithStatus(promise: Promise) {
        val pm: PackageManager = reactApplicationContext.packageManager
        val result = WritableNativeArray()
        CURATED_APPS.forEach { (pkg, fallbackName) ->
            val installed = try {
                pm.getApplicationInfo(pkg, 0)
                true
            } catch (e: PackageManager.NameNotFoundException) {
                false
            }
            val appName = if (installed) {
                try { pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString() }
                catch (e: Exception) { fallbackName }
            } else {
                fallbackName
            }
            val map = WritableNativeMap().apply {
                putString("packageName", pkg)
                putString("appName", appName)
                putBoolean("installed", installed)
            }
            result.pushMap(map)
        }
        promise.resolve(result)
    }

    /**
     * Returns only curated apps that are installed (used by usage queries).
     */
    @ReactMethod
    fun getInstalledMonitoredApps(promise: Promise) {
        val pm: PackageManager = reactApplicationContext.packageManager
        val result = WritableNativeArray()
        CURATED_APPS.forEach { (pkg, fallbackName) ->
            try {
                val appInfo = pm.getApplicationInfo(pkg, 0)
                val map = WritableNativeMap().apply {
                    putString("packageName", pkg)
                    putString("appName", pm.getApplicationLabel(appInfo).toString())
                }
                result.pushMap(map)
            } catch (e: PackageManager.NameNotFoundException) {
                // Not installed — skip
            }
        }
        promise.resolve(result)
    }

    /**
     * Returns all apps visible in the device's app drawer, excluding our own app
     * and anything already in the curated list. Sorted alphabetically by display name.
     *
     * Uses queryIntentActivities(LAUNCHER) instead of getInstalledApplications() so
     * that the Android 11+ package visibility system (governed by the <queries> launcher
     * intent entry in AndroidManifest.xml) correctly surfaces all launchable apps —
     * including pre-installed ones like Chrome, Gmail, YouTube Music, and Google Photos
     * that getInstalledApplications() would silently omit without QUERY_ALL_PACKAGES.
     */
    @ReactMethod
    fun getInstalledUserApps(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val curatedPackages = CURATED_APPS.map { it.first }.toSet()
            val ourPackage = reactApplicationContext.packageName

            val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            val activities: List<ResolveInfo> = pm.queryIntentActivities(launcherIntent, 0)

            val apps = activities
                .map { it.activityInfo.packageName to it.loadLabel(pm).toString() }
                .distinctBy { it.first }
                .filter { (pkg, _) -> pkg != ourPackage && pkg !in curatedPackages }
                .sortedBy { it.second.lowercase() }

            val result = WritableNativeArray()
            apps.forEach { (pkg, name) ->
                val map = WritableNativeMap().apply {
                    putString("packageName", pkg)
                    putString("appName", name)
                }
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_INSTALLED_APPS_FAILED", e.message)
        }
    }

    /**
     * Writes all monitor configuration to SharedPreferences.
     * Called whenever the user changes monitored apps or intensity preset.
     * The native service reads concrete numbers — it has no knowledge of preset names.
     */
    @ReactMethod
    fun setMonitorPrefs(
        installDate: Double,
        monitoredPackages: ReadableArray,
        intensity: String,
        sampleDays: Int,
        weeklyReductionPct: Double,
        nudgeBufferPct: Double,
        frictionType: String,
        cooldownMinutes: Int,
        baselineCapMinutes: Int,
        floorMinutes: Int,
        promise: Promise
    ) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(
                "scrollguard_prefs", Context.MODE_PRIVATE
            )
            val pkgSet = mutableSetOf<String>()
            for (i in 0 until monitoredPackages.size()) {
                monitoredPackages.getString(i)?.let { pkgSet.add(it) }
            }
            prefs.edit()
                .putLong("installDate", installDate.toLong())
                .putStringSet("monitoredApps", pkgSet)
                .putString("intensity", intensity)
                .putInt("sampleDays", sampleDays)
                .putFloat("weeklyReductionPct", weeklyReductionPct.toFloat())
                .putFloat("nudgeBufferPct", nudgeBufferPct.toFloat())
                .putString("frictionType", frictionType)
                .putInt("cooldownMinutes", cooldownMinutes)
                .putInt("baselineCapMinutes", baselineCapMinutes)
                .putInt("floorMinutes", floorMinutes)
                .apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PREFS_WRITE_FAILED", e.message)
        }
    }

    /**
     * Returns the app icon for a given package as a Base64-encoded PNG string.
     * Capped at 72×72px — large enough for a list row, small enough to keep
     * the bridge payload light (~3–8 KB per icon).
     * Called lazily per visible row so the list opens instantly.
     */
    @ReactMethod
    fun getAppIcon(packageName: String, promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val drawable: Drawable = pm.getApplicationIcon(packageName)

            val size = 72
            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            drawable.setBounds(0, 0, size, size)
            drawable.draw(canvas)

            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 90, stream)
            val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
            promise.resolve(base64)
        } catch (e: Exception) {
            promise.resolve("")  // empty string = show initial placeholder
        }
    }
}
