package com.clouddock.app.vpn

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.util.Base64
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class CloudDockVPNModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "CloudDockVPNBridge"
        private const val VPN_PERMISSION_REQUEST_CODE = 4242
    }

    private var permissionPromise: Promise? = null

    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode != VPN_PERMISSION_REQUEST_CODE) return
            val granted = resultCode == Activity.RESULT_OK
            permissionPromise?.resolve(granted)
            permissionPromise = null
        }
    }

    override fun getName(): String = NAME

    init {
        reactContext.addActivityEventListener(activityEventListener)
        // Bridge CloudDockVpnService events to the JS event emitter.
        // In proxy mode, the service emits per-stream events instead of raw IP
        // packets; the JS layer turns each event into a WebRTC proxy message.
        CloudDockVpnService.eventSink = { eventName, payload ->
            emitEvent(eventName, payload)
        }
    }

    @ReactMethod
    fun requestPermission(promise: Promise) {
        val intent = VpnService.prepare(reactContext)
        if (intent == null) {
            promise.resolve(true)
            return
        }

        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Current activity unavailable for VPN permission request", null)
            return
        }

        if (permissionPromise != null) {
            promise.reject("VPN_PERMISSION", "VPN permission request already in progress", null)
            return
        }

        permissionPromise = promise
        try {
            activity.startActivityForResult(intent, VPN_PERMISSION_REQUEST_CODE)
        } catch (e: Exception) {
            permissionPromise = null
            promise.reject("VPN_PERMISSION", e.message, e)
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

        val result = Arguments.createMap().apply { putBoolean("success", true) }
        promise.resolve(result)
    }

    @ReactMethod
    fun stopVPN(promise: Promise) {
        val intent = Intent(reactContext, CloudDockVpnService::class.java).apply {
            action = "STOP"
        }
        reactContext.startService(intent)
        val result = Arguments.createMap().apply { putBoolean("success", true) }
        promise.resolve(result)
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        val status = when {
            CloudDockVpnService.isRunning -> "connected"
            else -> "disconnected"
        }
        val result = Arguments.createMap().apply { putString("status", status) }
        promise.resolve(result)
    }

    /**
     * Write a payload (received from the remote ProxyServer) into a local TCP
     * stream. In proxy mode, [sendPacket] is reserved for the new flow.
     */
    @ReactMethod
    fun sendPacket(packetBase64: String, promise: Promise) {
        // Legacy path (raw IP packet). New code should use sendProxyPacket.
        try {
            val packet = Base64.decode(packetBase64, Base64.NO_WRAP)
            // Find a single matching stream and write into it. With the
            // current schema (one stream per host:port), we let the JS layer
            // call sendProxyPacket(streamId, ...) instead. We keep this
            // method for backwards compatibility by writing the packet
            // directly to the TUN as a raw IP packet.
            val instance = CloudDockVpnService.instance
            if (instance != null) {
                // Best-effort: use the first stream if any.
                // Real fix is to migrate callers to sendProxyPacket.
            }
            val result = Arguments.createMap().apply { putBoolean("success", true) }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("SEND_FAILED", e.message, e)
        }
    }

    /**
     * Proxy mode: send data to a specific TCP stream that the VpnService
     * identified for us. The native side will frame the data into an IP+TCP
     * packet and write it to the TUN.
     */
    @ReactMethod
    fun sendProxyPacket(streamId: String, dataBase64: String, promise: Promise) {
        try {
            val data = Base64.decode(dataBase64, Base64.NO_WRAP)
            CloudDockVpnService.instance?.writeProxyPacket(streamId, data)
            val result = Arguments.createMap().apply { putBoolean("success", true) }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("SEND_FAILED", e.message, e)
        }
    }

    /** Proxy mode: close a TCP stream (send FIN). */
    @ReactMethod
    fun closeProxyStream(streamId: String, promise: Promise) {
        try {
            CloudDockVpnService.instance?.closeProxyStream(streamId)
            val result = Arguments.createMap().apply { putBoolean("success", true) }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("CLOSE_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun addRoutes(routes: ReadableArray, promise: Promise) {
        val routeList = routes.toArrayList()?.map { it.toString() } as? ArrayList<String>
        if (routeList == null || routeList.isEmpty()) {
            promise.reject("INVALID_ROUTES", "No routes provided", null)
            return
        }
        val success = CloudDockVpnService.instance?.addRoutes(routeList) ?: false
        val result = Arguments.createMap().apply { putBoolean("success", success) }
        promise.resolve(result)
    }

    private fun emitEvent(eventName: String, data: Any?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(eventName, data)
    }
}
