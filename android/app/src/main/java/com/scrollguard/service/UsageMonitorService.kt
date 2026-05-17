package com.scrollguard.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.scrollguard.MainActivity
import com.scrollguard.overlay.NudgeOverlayService

class UsageMonitorService : Service() {

    companion object {
        const val ACTION_START             = "com.scrollguard.START_MONITOR"
        const val ACTION_STOP              = "com.scrollguard.STOP_MONITOR"
        const val ACTION_APP_FOREGROUNDED  = "com.scrollguard.APP_FOREGROUNDED"
        const val EXTRA_PACKAGE_NAME       = "packageName"

        private const val CHANNEL_ID       = "scrollguard_monitor"
        private const val NOTIF_ID         = 1001
        private const val POLL_INTERVAL_MS = 60_000L

        private const val PREFS_NAME       = "scrollguard_prefs"

        // SharedPreferences keys — must match what UsageStatsModule writes
        private const val KEY_INSTALL_DATE         = "installDate"
        private const val KEY_MONITORED_APPS       = "monitoredApps"
        private const val KEY_SAMPLE_DAYS          = "sampleDays"
        private const val KEY_WEEKLY_REDUCTION_PCT = "weeklyReductionPct"
        private const val KEY_NUDGE_BUFFER_PCT     = "nudgeBufferPct"
        private const val KEY_FRICTION_TYPE        = "frictionType"
        private const val KEY_COOLDOWN_MINUTES     = "cooldownMinutes"
        private const val KEY_BASELINE_CAP_MIN     = "baselineCapMinutes"
        private const val KEY_FLOOR_MINUTES        = "floorMinutes"

        // Fallback defaults (mirrors 'balanced' preset) — used before JS writes prefs
        private const val DEFAULT_SAMPLE_DAYS          = 4
        private const val DEFAULT_WEEKLY_REDUCTION_PCT = 0.20f
        private const val DEFAULT_NUDGE_BUFFER_PCT     = 0.10f
        private const val DEFAULT_FRICTION_TYPE        = "soft"
        private const val DEFAULT_COOLDOWN_MINUTES     = 30
        private const val DEFAULT_BASELINE_CAP_MIN     = 180
        private const val DEFAULT_FLOOR_MINUTES        = 30
    }

    private val handler = Handler(Looper.getMainLooper())

    // pkg → last nudge timestamp (ms); enforces cooldown between nudges
    private val lastNudgeAt = mutableMapOf<String, Long>()

    private val pollRunnable = object : Runnable {
        override fun run() {
            checkUsageAndNudge()
            handler.postDelayed(this, POLL_INTERVAL_MS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIF_ID, buildNotification())
        handler.post(pollRunnable)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) stopSelf()
        return START_STICKY
    }

    // ─── Core nudge logic ────────────────────────────────────────────────────

    private fun checkUsageAndNudge() {
        val prefs       = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val installDate = prefs.getLong(KEY_INSTALL_DATE, 0L)
        if (installDate == 0L) return

        val monitoredApps = prefs.getStringSet(KEY_MONITORED_APPS, emptySet()) ?: return
        if (monitoredApps.isEmpty()) return

        val sampleDays        = prefs.getInt(KEY_SAMPLE_DAYS, DEFAULT_SAMPLE_DAYS)
        val reductionPct      = prefs.getFloat(KEY_WEEKLY_REDUCTION_PCT, DEFAULT_WEEKLY_REDUCTION_PCT)
        val bufferPct         = prefs.getFloat(KEY_NUDGE_BUFFER_PCT, DEFAULT_NUDGE_BUFFER_PCT)
        val frictionType      = prefs.getString(KEY_FRICTION_TYPE, DEFAULT_FRICTION_TYPE) ?: DEFAULT_FRICTION_TYPE
        val cooldownMs        = prefs.getInt(KEY_COOLDOWN_MINUTES, DEFAULT_COOLDOWN_MINUTES) * 60_000L
        val baselineCapMs     = prefs.getInt(KEY_BASELINE_CAP_MIN, DEFAULT_BASELINE_CAP_MIN) * 60_000L
        val floorMs           = prefs.getInt(KEY_FLOOR_MINUTES, DEFAULT_FLOOR_MINUTES) * 60_000L

        val now           = System.currentTimeMillis()
        val daysSinceInstall = (now - installDate) / 86_400_000L

        // Still in the sampling period — collect data, no nudges
        if (daysSinceInstall < sampleDays) return

        val todayStart    = getTodayStartMs()
        val usm           = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

        // Query today's usage
        val todayStats    = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, todayStart, now)
            ?: return
        val todayUsage    = aggregateUsage(todayStats, monitoredApps)

        // Compute each app's adaptive target for today
        monitoredApps.forEach { pkg ->
            val todayMs   = todayUsage[pkg] ?: 0L

            // Baseline: average daily usage over the sample window, capped
            val baselineMs = computeBaseline(usm, pkg, installDate, sampleDays, baselineCapMs)

            // Week number (1-based). Target drops by reductionPct each week after sampling.
            val weeksAfterSampling = ((daysSinceInstall - sampleDays) / 7L).toInt()
            val targetMs = maxOf(
                floorMs,
                (baselineMs * Math.pow((1.0 - reductionPct).toDouble(), weeksAfterSampling.toDouble())).toLong()
            )

            // Nudge threshold = target * (1 + bufferPct)
            val nudgeThresholdMs = (targetMs * (1.0 + bufferPct)).toLong()

            if (todayMs >= nudgeThresholdMs) {
                val lastNudge = lastNudgeAt[pkg] ?: 0L
                if (now - lastNudge >= cooldownMs) {
                    lastNudgeAt[pkg] = now
                    val minutesOver = ((todayMs - targetMs) / 60_000L).toInt()
                    fireNudge(pkg, (todayMs / 60_000L).toInt(), minutesOver, frictionType)
                }
            }
        }
    }

    /**
     * Computes average daily usage for [pkg] over the sample window.
     * Uses INTERVAL_WEEKLY query for efficiency, then divides by sampleDays.
     */
    private fun computeBaseline(
        usm: UsageStatsManager,
        pkg: String,
        installDate: Long,
        sampleDays: Int,
        baselineCapMs: Long,
    ): Long {
        val windowEnd   = installDate + sampleDays * 86_400_000L
        val stats       = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, installDate, windowEnd)
            ?: return baselineCapMs
        val totalMs     = stats.filter { it.packageName == pkg }.sumOf { it.totalTimeInForeground }
        val avgMs       = if (sampleDays > 0) totalMs / sampleDays else totalMs
        return minOf(avgMs, baselineCapMs)
    }

    private fun aggregateUsage(
        stats: List<android.app.usage.UsageStats>,
        packages: Set<String>,
    ): Map<String, Long> {
        val result = mutableMapOf<String, Long>()
        stats.forEach { stat ->
            if (stat.packageName in packages) {
                result[stat.packageName] =
                    (result[stat.packageName] ?: 0L) + stat.totalTimeInForeground
            }
        }
        return result
    }

    private fun fireNudge(pkg: String, minutesUsed: Int, minutesOver: Int, frictionType: String) {
        val appName = try {
            val info = packageManager.getApplicationInfo(pkg, 0)
            packageManager.getApplicationLabel(info).toString()
        } catch (e: Exception) { pkg }

        val message = when (frictionType) {
            "hard"    -> "You're ${minutesOver}m over today's target. Tap to decide."
            "soft"    -> "You're ${minutesOver}m over today's target. Opening in 5 seconds…"
            else      -> "You're ${minutesOver}m over today's target. Worth a break?"
        }

        startService(
            Intent(this, NudgeOverlayService::class.java).apply {
                action = NudgeOverlayService.ACTION_SHOW
                putExtra(NudgeOverlayService.EXTRA_APP_NAME, appName)
                putExtra(NudgeOverlayService.EXTRA_MINUTES_USED, minutesUsed)
                putExtra(NudgeOverlayService.EXTRA_MESSAGE, message)
                putExtra(NudgeOverlayService.EXTRA_FRICTION_TYPE, frictionType)
            }
        )
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private fun getTodayStartMs(): Long {
        val cal = java.util.Calendar.getInstance().apply {
            set(java.util.Calendar.HOUR_OF_DAY, 0)
            set(java.util.Calendar.MINUTE, 0)
            set(java.util.Calendar.SECOND, 0)
            set(java.util.Calendar.MILLISECOND, 0)
        }
        return cal.timeInMillis
    }

    // ─── Notification / lifecycle ─────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "ScrollGuard Monitor",
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                description = "Keeps usage tracking running in the background"
                setShowBadge(false)
            }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val launch = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ScrollGuard is watching for you")
            .setContentText("Tracking your screen time in the background")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentIntent(launch)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setSilent(true)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        handler.removeCallbacks(pollRunnable)
        super.onDestroy()
    }
}
