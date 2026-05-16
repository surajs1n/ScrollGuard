package com.scrollguard.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED &&
            intent.action != "android.intent.action.QUICKBOOT_POWERON"
        ) return

        // Restart the monitoring service after device reboot
        val serviceIntent = Intent(context, UsageMonitorService::class.java).apply {
            action = UsageMonitorService.ACTION_START
        }
        context.startForegroundService(serviceIntent)
    }
}
