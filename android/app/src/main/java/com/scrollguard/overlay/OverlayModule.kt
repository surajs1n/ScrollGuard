package com.scrollguard.overlay

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = OverlayModule.NAME)
class OverlayModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "Overlay"
    }

    override fun getName() = NAME

    @ReactMethod
    fun hasOverlayPermission(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        try {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${reactApplicationContext.packageName}")
            ).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SETTINGS_OPEN_FAILED", e.message)
        }
    }

    /**
     * Show the nudge overlay for the given app.
     * message: The nudge text to display.
     * appName: Friendly name of the app being nudged.
     * minutesUsed: How many minutes the user has spent so far.
     */
    @ReactMethod
    fun showNudge(appName: String, minutesUsed: Int, message: String, promise: Promise) {
        if (!Settings.canDrawOverlays(reactApplicationContext)) {
            promise.reject("NO_OVERLAY_PERMISSION", "SYSTEM_ALERT_WINDOW permission not granted")
            return
        }
        try {
            val intent = Intent(reactApplicationContext, NudgeOverlayService::class.java).apply {
                action = NudgeOverlayService.ACTION_SHOW
                putExtra(NudgeOverlayService.EXTRA_APP_NAME, appName)
                putExtra(NudgeOverlayService.EXTRA_MINUTES_USED, minutesUsed)
                putExtra(NudgeOverlayService.EXTRA_MESSAGE, message)
            }
            reactApplicationContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SHOW_FAILED", e.message)
        }
    }

    @ReactMethod
    fun dismissNudge(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, NudgeOverlayService::class.java).apply {
                action = NudgeOverlayService.ACTION_DISMISS
            }
            reactApplicationContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DISMISS_FAILED", e.message)
        }
    }
}
