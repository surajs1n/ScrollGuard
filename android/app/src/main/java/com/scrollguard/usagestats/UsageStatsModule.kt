package com.scrollguard.usagestats

import android.app.AppOpsManager
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
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

        // Apps we care about for V1
        val MONITORED_PACKAGES = listOf(
            "com.instagram.android",
            "com.google.android.youtube",
            "com.reddit.frontpage",
            "com.snapchat.android",
            "com.zhiliaoapp.musically",
            "com.twitter.android",
            "com.facebook.katana",
            "com.linkedin.android",
            "com.whatsapp",
        )
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
     * Returns list of monitored apps that are installed on this device.
     */
    @ReactMethod
    fun getInstalledMonitoredApps(promise: Promise) {
        val pm: PackageManager = reactApplicationContext.packageManager
        val result = WritableNativeArray()
        MONITORED_PACKAGES.forEach { pkg ->
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
     * Writes install date and monitored app list into the SharedPreferences
     * that UsageMonitorService reads. Called once at the end of onboarding.
     */
    @ReactMethod
    fun setMonitorPrefs(installDate: Double, monitoredPackages: ReadableArray, promise: Promise) {
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
                .apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PREFS_WRITE_FAILED", e.message)
        }
    }
}
