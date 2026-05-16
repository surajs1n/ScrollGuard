package com.scrollguard.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.scrollguard.MainActivity
import com.scrollguard.overlay.NudgeOverlayService
import com.scrollguard.usagestats.UsageStatsModule

/**
 * Long-running foreground service that:
 * 1. Polls UsageStatsManager every 60 seconds.
 * 2. Tracks per-app session time in memory (resets when the user switches apps).
 * 3. Fires nudges at 30-min and 60-min thresholds (Week 2+ behaviour).
 * 4. Accepts ACTION_APP_FOREGROUNDED from the AccessibilityService for faster detection.
 *
 * Week gating is read from SharedPreferences — the JS layer writes the install week.
 */
class UsageMonitorService : Service() {

    companion object {
        const val ACTION_START = "com.scrollguard.START_MONITOR"
        const val ACTION_STOP = "com.scrollguard.STOP_MONITOR"
        const val ACTION_APP_FOREGROUNDED = "com.scrollguard.APP_FOREGROUNDED"
        const val EXTRA_PACKAGE_NAME = "packageName"

        private const val CHANNEL_ID = "scrollguard_monitor"
        private const val NOTIF_ID = 1001
        private const val POLL_INTERVAL_MS = 60_000L // 1 minute

        private const val PREFS_NAME = "scrollguard_prefs"
        private const val PREF_INSTALL_DATE = "installDate"
        private const val PREF_MONITORED_APPS = "monitoredApps"

        // Nudge thresholds in minutes
        private val NUDGE_THRESHOLDS = listOf(30, 60)
    }

    private val handler = Handler(Looper.getMainLooper())
    private val sessionStart = mutableMapOf<String, Long>() // pkg → session start timestamp
    private val firedThresholds = mutableMapOf<String, MutableSet<Int>>() // pkg → fired minutes
    private var currentForegroundPkg: String? = null

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
        when (intent?.action) {
            ACTION_APP_FOREGROUNDED -> {
                val pkg = intent.getStringExtra(EXTRA_PACKAGE_NAME) ?: return START_STICKY
                handleAppForegrounded(pkg)
            }
            ACTION_STOP -> stopSelf()
        }
        return START_STICKY
    }

    private fun handleAppForegrounded(pkg: String) {
        if (pkg == currentForegroundPkg) return

        currentForegroundPkg = pkg

        if (pkg in getMonitoredApps()) {
            // Start tracking session if not already started
            if (!sessionStart.containsKey(pkg)) {
                sessionStart[pkg] = System.currentTimeMillis()
                firedThresholds.getOrPut(pkg) { mutableSetOf() }.clear()
            }
        }
    }

    private fun checkUsageAndNudge() {
        if (!shouldNudge()) return
        val monitoredApps = getMonitoredApps()
        if (monitoredApps.isEmpty()) return

        val now = System.currentTimeMillis()
        val todayStart = getTodayStartMs()

        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val stats = usm.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY, todayStart, now
        ) ?: return

        // Aggregate usage per package
        val usage = mutableMapOf<String, Long>()
        stats.forEach { stat ->
            if (stat.packageName in monitoredApps) {
                usage[stat.packageName] =
                    (usage[stat.packageName] ?: 0L) + stat.totalTimeInForeground
            }
        }

        usage.forEach { (pkg, totalMs) ->
            val minutes = (totalMs / 60_000L).toInt()
            val fired = firedThresholds.getOrPut(pkg) { mutableSetOf() }

            NUDGE_THRESHOLDS.forEach { threshold ->
                if (minutes >= threshold && threshold !in fired) {
                    fired.add(threshold)
                    fireNudge(pkg, minutes)
                }
            }
        }
    }

    private fun fireNudge(pkg: String, minutesUsed: Int) {
        val appName = try {
            val info = packageManager.getApplicationInfo(pkg, 0)
            packageManager.getApplicationLabel(info).toString()
        } catch (e: Exception) {
            pkg
        }

        val message = when {
            minutesUsed >= 60 -> "You've been here over an hour. Your attention is worth more."
            minutesUsed >= 30 -> "Half an hour in. How are you feeling about this?"
            else -> "Just checking in."
        }

        val intent = Intent(this, NudgeOverlayService::class.java).apply {
            action = NudgeOverlayService.ACTION_SHOW
            putExtra(NudgeOverlayService.EXTRA_APP_NAME, appName)
            putExtra(NudgeOverlayService.EXTRA_MINUTES_USED, minutesUsed)
            putExtra(NudgeOverlayService.EXTRA_MESSAGE, message)
        }
        startService(intent)
    }

    /**
     * Nudging only kicks in from Week 2 onwards (day 8+).
     * Week is derived from install date stored in SharedPreferences.
     */
    private fun shouldNudge(): Boolean {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val installDate = prefs.getLong(PREF_INSTALL_DATE, 0L)
        if (installDate == 0L) return false
        val daysSinceInstall = (System.currentTimeMillis() - installDate) / 86_400_000L
        return daysSinceInstall >= 7
    }

    private fun getMonitoredApps(): Set<String> {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getStringSet(PREF_MONITORED_APPS, emptySet()) ?: emptySet()
    }

    private fun getTodayStartMs(): Long {
        val cal = java.util.Calendar.getInstance().apply {
            set(java.util.Calendar.HOUR_OF_DAY, 0)
            set(java.util.Calendar.MINUTE, 0)
            set(java.util.Calendar.SECOND, 0)
            set(java.util.Calendar.MILLISECOND, 0)
        }
        return cal.timeInMillis
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "ScrollGuard Monitor",
                NotificationManager.IMPORTANCE_MIN // silent — no sound, no badge
            ).apply {
                description = "Keeps usage tracking running in the background"
                setShowBadge(false)
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val launchIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ScrollGuard is watching for you")
            .setContentText("Tracking your screen time in the background")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentIntent(launchIntent)
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
