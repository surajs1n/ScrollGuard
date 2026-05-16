package com.scrollguard.overlay

import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.LayoutInflater
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView

/**
 * A lightweight Service that draws a semi-transparent nudge card on top of whatever
 * app the user is currently in. Requires SYSTEM_ALERT_WINDOW permission.
 *
 * The card shows:
 *  - How long the user has been in the monitored app
 *  - A short nudge message
 *  - A "Keep scrolling" dismiss button (no judgment)
 *  - A "Do something else" button that takes the user back to ScrollGuard
 */
class NudgeOverlayService : Service() {

    companion object {
        const val ACTION_SHOW = "com.scrollguard.SHOW_NUDGE"
        const val ACTION_DISMISS = "com.scrollguard.DISMISS_NUDGE"
        const val EXTRA_APP_NAME = "appName"
        const val EXTRA_MINUTES_USED = "minutesUsed"
        const val EXTRA_MESSAGE = "message"
    }

    private var windowManager: WindowManager? = null
    private var overlayView: android.view.View? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_SHOW -> {
                val appName = intent.getStringExtra(EXTRA_APP_NAME) ?: "this app"
                val minutes = intent.getIntExtra(EXTRA_MINUTES_USED, 0)
                val message = intent.getStringExtra(EXTRA_MESSAGE)
                    ?: "You've been here a while."
                showOverlay(appName, minutes, message)
            }
            ACTION_DISMISS -> dismissOverlay()
        }
        return START_NOT_STICKY
    }

    private fun showOverlay(appName: String, minutes: Int, message: String) {
        dismissOverlay() // clear any existing overlay first

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        // Build the overlay view programmatically — no XML layout required
        val ctx = this
        overlayView = android.widget.LinearLayout(ctx).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(48, 48, 48, 48)
            setBackgroundColor(Color.parseColor("#E60f172a")) // near-opaque navy

            // Title: time spent
            addView(TextView(ctx).apply {
                text = "${minutes}m on $appName"
                textSize = 18f
                setTextColor(Color.WHITE)
                gravity = Gravity.CENTER
            })

            // Nudge message
            addView(TextView(ctx).apply {
                text = message
                textSize = 14f
                setTextColor(Color.parseColor("#94a3b8")) // slate-400
                gravity = Gravity.CENTER
                setPadding(0, 16, 0, 32)
            })

            // "Do something else" CTA
            addView(Button(ctx).apply {
                text = "Do something else"
                setBackgroundColor(Color.parseColor("#6366f1")) // indigo-500
                setTextColor(Color.WHITE)
                setOnClickListener {
                    dismissOverlay()
                    // Launch ScrollGuard so the user sees an activity suggestion
                    val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                        putExtra("openSuggestion", true)
                    }
                    if (launch != null) startActivity(launch)
                }
            })

            // Dismiss — no guilt
            addView(Button(ctx).apply {
                text = "Keep scrolling"
                setBackgroundColor(Color.TRANSPARENT)
                setTextColor(Color.parseColor("#64748b")) // slate-500
                setOnClickListener { dismissOverlay() }
            })
        }

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM
        }

        windowManager?.addView(overlayView, params)
    }

    private fun dismissOverlay() {
        overlayView?.let {
            windowManager?.removeView(it)
            overlayView = null
        }
    }

    override fun onDestroy() {
        dismissOverlay()
        super.onDestroy()
    }
}
