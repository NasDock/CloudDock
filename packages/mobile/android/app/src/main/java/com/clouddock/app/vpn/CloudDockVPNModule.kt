package com.clouddock.app.vpn

import android.content.Intent
import android.net.VpnService
import android.util.Base64
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class CloudDockVPNModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "CloudDockVPNBridge"
    }

    override fun getName(): String = NAME

    init {
        CloudDockVpnService.onPacketReceived = { packet ->
            val base64 = Base64.encodeToString(packet, Base64.NO_WRAP)
            emitEvent("vpnPacketReceived", base64)
        }
    }

    @ReactMethod
    fun startVPN(config: ReadableMap, promise: Promise) {
        val tunnelAddress = config.getString("tunnelAddress")
        val subnetMask = config.getString("subnetMask") ?: "255.255.255.0"
        val mtu = if (config.hasKey("mtu")) config.getInt("mtu") else 1280
        val dnsServers = if (config.hasKey("dnsServers")) {
            config.getArray("dnsServers")?.toArrayList()?.map { it.toString() } as? ArrayList<String>
        } else null
        val routes = if (config.hasKey("routes")) {
            config.getArray("routes")?.toArrayList()?.map { it.toString() } as? ArrayList<String>
        } else null

        if (tunnelAddress == null) {
            promise.reject("INVALID_CONFIG", "Missing tunnelAddress", null)
            return
        }

        val intent = VpnService.prepare(reactContext)
        if (intent != null) {
            promise.reject("VPN_PERMISSION", "VPN permission not granted", null)
            return
        }

        val serviceIntent = Intent(reactContext, CloudDockVpnService::class.java).apply {
            putExtra("tunnelAddress", tunnelAddress)
            putExtra("subnetMask", subnetMask)
            putExtra("mtu", mtu)
            dnsServers?.let { putStringArrayListExtra("dnsServers", it) }
            routes?.let { putStringArrayListExtra("routes", it) }
        }

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            reactContext.startForegroundService(serviceIntent)
        } else {
            reactContext.startService(serviceIntent)
        }

        promise.resolve(java.util.HashMap<String, Any>().apply { put("success", true) })
    }

    @ReactMethod
    fun stopVPN(promise: Promise) {
        val intent = Intent(reactContext, CloudDockVpnService::class.java).apply {
            action = "STOP"
        }
        reactContext.startService(intent)
        promise.resolve(java.util.HashMap<String, Any>().apply { put("success", true) })
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        val status = when {
            CloudDockVpnService.isRunning -> "connected"
            else -> "disconnected"
        }
        promise.resolve(java.util.HashMap<String, Any>().apply { put("status", status) })
    }

    @ReactMethod
    fun sendPacket(packetBase64: String, promise: Promise) {
        try {
            val packet = Base64.decode(packetBase64, Base64.NO_WRAP)
            CloudDockVpnService.instance?.writePacket(packet)
            promise.resolve(java.util.HashMap<String, Any>().apply { put("success", true) })
        } catch (e: Exception) {
            promise.reject("SEND_FAILED", e.message, e)
        }
    }

    private fun emitEvent(eventName: String, data: Any?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(eventName, data)
    }
}
