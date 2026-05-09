package com.clouddock.app.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.IBinder
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.NotificationCompat
import com.clouddock.app.MainActivity
import com.clouddock.app.R
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class CloudDockVpnService : VpnService() {

    companion object {
        const val TAG = "CloudDockVpn"
        const val NOTIFICATION_CHANNEL_ID = "clouddock_vpn"
        const val NOTIFICATION_ID = 1001

        @Volatile
        var onPacketReceived: ((ByteArray) -> Unit)? = null

        @Volatile
        var isRunning: Boolean = false
            private set

        @Volatile
        var instance: CloudDockVpnService? = null
    }

    private var vpnInterface: ParcelFileDescriptor? = null
    private var inputStream: FileInputStream? = null
    private var outputStream: FileOutputStream? = null
    private var executor: ExecutorService? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == "STOP") {
            stopVpn()
            return START_NOT_STICKY
        }

        val tunnelAddress = intent?.getStringExtra("tunnelAddress") ?: "100.64.0.2"
        val subnetMask = intent?.getStringExtra("subnetMask") ?: "255.255.255.0"
        val mtu = intent?.getIntExtra("mtu", 1280) ?: 1280
        val routes = intent?.getStringArrayListExtra("routes") ?: arrayListOf("100.64.0.0/24")
        val dnsServers = intent?.getStringArrayListExtra("dnsServers") ?: arrayListOf("8.8.8.8", "1.1.1.1")

        startVpn(tunnelAddress, subnetMask, mtu, routes, dnsServers)
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun startVpn(
        address: String,
        mask: String,
        mtu: Int,
        routes: ArrayList<String>,
        dnsServers: ArrayList<String>
    ) {
        if (isRunning) return

        val builder = Builder()
            .setSession("CloudDock VPN")
            .addAddress(address, prefixLength(mask))
            .setMtu(mtu)
            .setBlocking(true)

        for (route in routes) {
            val parts = route.split("/")
            if (parts.size == 2) {
                builder.addRoute(parts[0], parts[1].toInt())
            }
        }

        for (dns in dnsServers) {
            builder.addDnsServer(dns)
        }

        vpnInterface = builder.establish()
        if (vpnInterface == null) {
            Log.e(TAG, "Failed to establish VPN interface")
            return
        }

        inputStream = FileInputStream(vpnInterface!!.fileDescriptor)
        outputStream = FileOutputStream(vpnInterface!!.fileDescriptor)
        isRunning = true
        instance = this

        startForeground(NOTIFICATION_ID, buildNotification())

        executor = Executors.newSingleThreadExecutor()
        executor?.execute { readLoop() }
    }

    private fun readLoop() {
        val buffer = ByteArray(32767) // max IP packet size + headroom
        while (isRunning) {
            try {
                val length = inputStream?.read(buffer) ?: break
                if (length > 0) {
                    val packet = buffer.copyOf(length)
                    onPacketReceived?.invoke(packet)
                }
            } catch (e: Exception) {
                if (isRunning) {
                    Log.e(TAG, "Error reading from TUN", e)
                }
                break
            }
        }
    }

    fun writePacket(packet: ByteArray) {
        try {
            outputStream?.write(packet)
        } catch (e: Exception) {
            Log.e(TAG, "Error writing to TUN", e)
        }
    }

    private fun stopVpn() {
        isRunning = false
        instance = null
        try {
            inputStream?.close()
            outputStream?.close()
            vpnInterface?.close()
        } catch (e: Exception) {
            Log.e(TAG, "Error closing VPN", e)
        }
        inputStream = null
        outputStream = null
        vpnInterface = null
        executor?.shutdownNow()
        executor = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        stopVpn()
        super.onDestroy()
    }

    private fun prefixLength(mask: String): Int {
        val parts = mask.split(".")
        var count = 0
        for (part in parts) {
            val num = part.toInt()
            count += Integer.bitCount(num)
        }
        return count
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "CloudDock VPN",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("CloudDock VPN")
            .setContentText("异地组网连接中")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }
}
