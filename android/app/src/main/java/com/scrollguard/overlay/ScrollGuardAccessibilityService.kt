package com.scrollguard.overlay

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import com.scrollguard.service.UsageMonitorService

/**
 * Detects foreground app changes via window-state events.
 * When the user opens a monitored app, notifies UsageMonitorService
 * which decides whether to show a nudge based on elapsed time.
 *
 * No content is read — only the package name of the foreground window.
 */
class ScrollGuardAccessibilityService : AccessibilityService() {

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return
        if (pkg == packageName) return // ignore ScrollGuard itself

        val intent = Intent(this, UsageMonitorService::class.java).apply {
            action = UsageMonitorService.ACTION_APP_FOREGROUNDED
            putExtra(UsageMonitorService.EXTRA_PACKAGE_NAME, pkg)
        }
        startService(intent)
    }

    override fun onInterrupt() {}
}
