package com.scrollguard.usagestats

import android.app.AppOpsManager
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.provider.Settings
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
                UsageStatsManager.INTERVAL_DAILY,
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
     * Returns usage stats only for the monitored apps that are installed.
     * Aggregates multiple entries for the same package (UsageStatsManager may return duplicates).
     */
    @ReactMethod
    fun getMonitoredAppsUsage(startTime: Double, endTime: Double, promise: Promise) {
        try {
            val usm = reactApplicationContext
                .getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

            val allStats: List<UsageStats> = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                startTime.toLong(),
                endTime.toLong()
            ) ?: emptyList()

            // Aggregate by package name (OS may return multiple entries per package)
            val aggregated = mutableMapOf<String, Long>()
            val lastUsed = mutableMapOf<String, Long>()
            allStats.forEach { stat ->
                if (stat.packageName in MONITORED_PACKAGES) {
                    aggregated[stat.packageName] =
                        (aggregated[stat.packageName] ?: 0L) + stat.totalTimeInForeground
                    lastUsed[stat.packageName] = maxOf(
                        lastUsed[stat.packageName] ?: 0L,
                        stat.lastTimeUsed
                    )
                }
            }

            val pm: PackageManager = reactApplicationContext.packageManager
            val result = WritableNativeArray()
            aggregated.forEach { (pkg, totalMs) ->
                val appName = try {
                    pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
                } catch (e: PackageManager.NameNotFoundException) {
                    pkg
                }
                val map = WritableNativeMap().apply {
                    putString("packageName", pkg)
                    putString("appName", appName)
                    putDouble("totalTimeMs", totalMs.toDouble())
                    putDouble("lastTimeUsed", (lastUsed[pkg] ?: 0L).toDouble())
                }
                result.pushMap(map)
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
     * Returns all user-installed apps on the device, excluding system apps,
     * our own app, and anything already in the curated list.
     * Sorted alphabetically by display name.
     */
    @ReactMethod
    fun getInstalledUserApps(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val curatedPackages = CURATED_APPS.map { it.first }.toSet()
            val ourPackage = reactApplicationContext.packageName

            val apps = pm.getInstalledApplications(0)
                .filter { info ->
                    val isSystemApp = (info.flags and ApplicationInfo.FLAG_SYSTEM) != 0
                    val hasLauncher = pm.getLaunchIntentForPackage(info.packageName) != null
                    !isSystemApp &&
                    hasLauncher &&
                    info.packageName != ourPackage &&
                    info.packageName !in curatedPackages
                }
                .map { info -> Pair(info.packageName, pm.getApplicationLabel(info).toString()) }
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
}
