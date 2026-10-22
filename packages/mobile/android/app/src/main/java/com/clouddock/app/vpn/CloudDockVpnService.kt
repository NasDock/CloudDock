package com.clouddock.app.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.NotificationCompat
import com.clouddock.app.MainActivity
import com.clouddock.app.R
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.Inet4Address
import java.net.InetAddress
import java.nio.ByteBuffer
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * CloudDock VpnService — runs the user-space TCP stack that turns OS-captured
 * IP/TCP packets into per-stream "proxy" events for the JS layer.
 *
 * The JS layer forwards each stream over WebRTC to a remote ProxyServer
 * (typically on the NAS). Inbound bytes from the remote are written back
 * through [writeProxyPacket], which the service frames into a minimal IP+TCP
 * response packet and writes to the TUN.
 *
 * Scope / non-goals (deliberate simplifications):
 *   - IPv4 only
 *   - TCP only (UDP / ICMP packets are silently dropped — DNS is therefore
 *     expected to be resolved by the system before reaching the tunnel)
 *   - No retransmission / congestion control. Each TCP stream is identified
 *     by the 4-tuple; sequence numbers are tracked so that we can emit the
 *     right acknowledgement window, but lost packets are not recovered.
 */
class CloudDockVpnService : VpnService() {

    companion object {
        const val TAG = "CloudDockVpn"
        const val NOTIFICATION_CHANNEL_ID = "clouddock_vpn"
        const val NOTIFICATION_ID = 1001

        const val EVENT_PROXY_CONNECT = "vpnProxyConnect"
        const val EVENT_PROXY_DATA = "vpnProxyData"
        const val EVENT_PROXY_CLOSE = "vpnProxyClose"

        @Volatile
        var eventSink: ((String, Any?) -> Unit)? = null

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
    private var lastIntent: Intent? = null

    private val streams = ConcurrentHashMap<String, TcpStream>()
    private val streamKeyIndex = ConcurrentHashMap<String, String>()

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

        startForeground(NOTIFICATION_ID, buildNotification("正在启动异地组网..."))

        lastIntent = intent

        val tunnelAddress = intent?.getStringExtra("tunnelAddress") ?: "100.64.0.2"
        val subnetMask = intent?.getStringExtra("subnetMask") ?: "255.255.255.0"
        val mtu = intent?.getIntExtra("mtu", 1280) ?: 1280
        val routes = intent?.getStringArrayListExtra("routes") ?: arrayListOf("100.64.0.0/24")
        val dnsServers = intent?.getStringArrayListExtra("dnsServers") ?: arrayListOf("8.8.8.8", "1.1.1.1")

        startVpn(tunnelAddress, subnetMask, mtu, routes, dnsServers)
        return START_STICKY
    }

    override fun onBind(intent: Intent?): android.os.IBinder? {
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
            val manager = getSystemService(NotificationManager::class.java)
            manager?.notify(NOTIFICATION_ID, buildNotification("VPN 启动失败"))
            return
        }

        inputStream = FileInputStream(vpnInterface!!.fileDescriptor)
        outputStream = FileOutputStream(vpnInterface!!.fileDescriptor)
        isRunning = true
        instance = this

        val manager = getSystemService(NotificationManager::class.java)
        manager?.notify(NOTIFICATION_ID, buildNotification("异地组网连接中"))

        executor = Executors.newSingleThreadExecutor()
        executor?.execute { readLoop() }
    }

    private fun readLoop() {
        val buffer = ByteArray(32767)
        var consecutiveErrors = 0
        while (isRunning) {
            try {
                val length = inputStream?.read(buffer) ?: break
                if (length > 0) {
                    handleInboundPacket(buffer, length)
                }
                consecutiveErrors = 0
            } catch (e: Exception) {
                if (!isRunning) break
                consecutiveErrors++
                // 跳过坏包继续处理，不让单个异常杀死整个 TUN 读循环
                Log.e(TAG, "readLoop: error #$consecutiveErrors processing packet, skipping", e)
                if (consecutiveErrors >= 50) {
                    Log.e(TAG, "readLoop: too many consecutive errors ($consecutiveErrors), exiting loop")
                    break
                }
            }
        }
    }

    private fun handleInboundPacket(buf: ByteArray, length: Int) {
        try {
            if (length < IPV4_HEADER_MIN) return
            val version = (buf[0].toInt() ushr 4) and 0x0F
            if (version != 4) return

            val ihl = (buf[0].toInt() and 0x0F) * 4
            if (ihl < IPV4_HEADER_MIN || length < ihl) return

            val protocol = buf[9].toInt() and 0xFF
            val srcIp = ipToInt(buf, 12)
            val dstIp = ipToInt(buf, 16)
            val totalLen = ((buf[2].toInt() and 0xFF) shl 8) or (buf[3].toInt() and 0xFF)

            if (protocol == IP_PROTO_TCP) {
                if (length < ihl + TCP_HEADER_MIN) return
                handleTcpPacket(buf, length, ihl, srcIp, dstIp, totalLen)
            } else {
                // UDP/ICMP/etc — not supported in proxy mode
            }
        } catch (e: Exception) {
            Log.e(TAG, "handleInboundPacket: dropped malformed packet", e)
        }
    }

    private fun handleTcpPacket(
        buf: ByteArray,
        length: Int,
        ipHeaderLen: Int,
        srcIp: Int,
        dstIp: Int,
        ipTotalLen: Int
    ) {
        try {
            handleTcpPacketInner(buf, length, ipHeaderLen, srcIp, dstIp, ipTotalLen)
        } catch (e: Exception) {
            Log.e(TAG, "handleTcpPacket: dropped malformed TCP packet", e)
        }
    }

    private fun handleTcpPacketInner(
        buf: ByteArray,
        length: Int,
        ipHeaderLen: Int,
        srcIp: Int,
        dstIp: Int,
        ipTotalLen: Int
    ) {
        val tcpOffset = ipHeaderLen
        val srcPort = ((buf[tcpOffset].toInt() and 0xFF) shl 8) or (buf[tcpOffset + 1].toInt() and 0xFF)
        val dstPort = ((buf[tcpOffset + 2].toInt() and 0xFF) shl 8) or (buf[tcpOffset + 3].toInt() and 0xFF)
        val dataOffset = ((buf[tcpOffset + 12].toInt() ushr 4) and 0x0F) * 4
        val flags = buf[tcpOffset + 13].toInt() and 0xFF
        val seqNum = readUint32(buf, tcpOffset + 4)
        val ackNum = readUint32(buf, tcpOffset + 8)
        val window = ((buf[tcpOffset + 14].toInt() and 0xFF) shl 8) or (buf[tcpOffset + 15].toInt() and 0xFF)

        val payloadStart = ipHeaderLen + dataOffset
        val payloadEnd = minOf(length, ipTotalLen)
        val payloadLen = (payloadEnd - payloadStart).coerceAtLeast(0)

        val key = streamKey(srcIp, srcPort, dstIp, dstPort)
        val isFin = (flags and TCP_FIN) != 0
        val isRst = (flags and TCP_RST) != 0
        val isSyn = (flags and TCP_SYN) != 0
        val isAck = (flags and TCP_ACK) != 0

        // SYN-only: register new stream, send SYN+ACK back.
        if (isSyn && !isAck) {
            val streamId = "stream_${System.currentTimeMillis().toString(36)}_${(0..0xffff).random().toString(16)}"
            val stream = TcpStream(
                streamId = streamId,
                srcIp = srcIp,
                srcPort = srcPort,
                dstIp = dstIp,
                dstPort = dstPort,
                localSeq = (System.nanoTime() and 0xFFFFFFFFL).toInt(),
                remoteSeq = (seqNum + 1) and 0xFFFFFFFFL.toInt(),
                remoteWindow = window
            )
            streams[streamId] = stream
            streamKeyIndex[key] = streamId

            // sendSynAck 先于 eventSink：即使事件桥抛异常，客户端也能收到 SYN+ACK
            sendSynAck(stream)

            eventSink?.invoke(EVENT_PROXY_CONNECT, mapOf(
                "streamId" to streamId,
                "host" to intToIp(dstIp),
                "port" to dstPort
            ))
            return
        }

        val streamId = streamKeyIndex[key]
        if (streamId == null) {
            return
        }
        val stream = streams[streamId] ?: return

        if (isRst || isFin) {
            closeStream(streamId, sendFinAck = !isRst)
            return
        }

        if (payloadLen > 0) {
            val payload = ByteArray(payloadLen)
            System.arraycopy(buf, payloadStart, payload, 0, payloadLen)
            stream.remoteSeq = (stream.remoteSeq + payloadLen) and 0xFFFFFFFFL.toInt()
            stream.remoteWindow = window
            // sendAck 先于 eventSink：保证 ACK 一定回到客户端
            sendAck(stream)
            eventSink?.invoke(EVENT_PROXY_DATA, mapOf(
                "streamId" to streamId,
                "data" to android.util.Base64.encodeToString(payload, android.util.Base64.NO_WRAP)
            ))
        }
    }

    private fun sendSynAck(stream: TcpStream) {
        writeTun(buildTcpPacket(
            srcIp = stream.dstIp,
            srcPort = stream.dstPort,
            dstIp = stream.srcIp,
            dstPort = stream.srcPort,
            seq = stream.localSeq,
            ack = stream.remoteSeq,
            flags = TCP_SYN or TCP_ACK,
            window = 65535,
            payload = null
        ))
    }

    private fun sendAck(stream: TcpStream) {
        writeTun(buildTcpPacket(
            srcIp = stream.dstIp,
            srcPort = stream.dstPort,
            dstIp = stream.srcIp,
            dstPort = stream.srcPort,
            seq = stream.localSeq,
            ack = stream.remoteSeq,
            flags = TCP_ACK,
            window = 65535,
            payload = null
        ))
    }

    private fun sendFinAck(stream: TcpStream) {
        writeTun(buildTcpPacket(
            srcIp = stream.dstIp,
            srcPort = stream.dstPort,
            dstIp = stream.srcIp,
            dstPort = stream.srcPort,
            seq = stream.localSeq,
            ack = stream.remoteSeq,
            flags = TCP_FIN or TCP_ACK,
            window = 65535,
            payload = null
        ))
    }

    private fun closeStream(streamId: String, sendFinAck: Boolean) {
        val stream = streams.remove(streamId) ?: return
        streamKeyIndex.remove(streamKey(stream.srcIp, stream.srcPort, stream.dstIp, stream.dstPort))
        if (sendFinAck) {
            sendFinAck(stream)
        }
        eventSink?.invoke(EVENT_PROXY_CLOSE, mapOf("streamId" to streamId))
    }

    /**
     * JS → native: write a payload (received from the remote ProxyServer) into
     * the local TCP stream. The packet is wrapped in a minimal IP+TCP header
     * and injected into the TUN. Sequence numbers are advanced.
     */
    fun writeProxyPacket(streamId: String, data: ByteArray) {
        val stream = streams[streamId] ?: return
        val pkt = buildTcpPacket(
            srcIp = stream.dstIp,
            srcPort = stream.dstPort,
            dstIp = stream.srcIp,
            dstPort = stream.srcPort,
            seq = stream.localSeq,
            ack = stream.remoteSeq,
            flags = TCP_PSH or TCP_ACK,
            window = 65535,
            payload = data
        )
        stream.localSeq = (stream.localSeq + data.size) and 0xFFFFFFFFL.toInt()
        writeTun(pkt)
    }

    /** JS → native: half-close a stream (FIN). */
    fun closeProxyStream(streamId: String) {
        val stream = streams[streamId] ?: return
        sendFinAck(stream)
    }

    private fun writeTun(packet: ByteArray) {
        try {
            outputStream?.write(packet)
        } catch (e: Exception) {
            Log.e(TAG, "Error writing to TUN", e)
        }
    }

    private fun buildTcpPacket(
        srcIp: Int,
        srcPort: Int,
        dstIp: Int,
        dstPort: Int,
        seq: Int,
        ack: Int,
        flags: Int,
        window: Int,
        payload: ByteArray?
    ): ByteArray {
        val tcpHeaderLen = TCP_HEADER_MIN
        val payloadLen = payload?.size ?: 0
        val totalLen = IPV4_HEADER_MIN + tcpHeaderLen + payloadLen

        val pkt = ByteArray(totalLen)

        // IPv4 header (IHL = 5, no options) — 20 bytes at offset 0
        pkt[0] = ((4 shl 4) or 5).toByte()            // version + IHL
        pkt[1] = 0                                     // DSCP/ECN
        pkt[2] = ((totalLen ushr 8) and 0xFF).toByte() // total length hi
        pkt[3] = (totalLen and 0xFF).toByte()          // total length lo
        // pkt[4..7] identification = 0
        // pkt[8..9] flags/fragment = 0
        pkt[10] = 64.toByte()                          // TTL
        pkt[11] = IP_PROTO_TCP.toByte()                // protocol
        // pkt[12..13] header checksum = 0 (filled below)
        // pkt[14..17] src IP
        // pkt[18..21] dst IP
        pkt[14] = ((srcIp ushr 24) and 0xFF).toByte()
        pkt[15] = ((srcIp ushr 16) and 0xFF).toByte()
        pkt[16] = ((srcIp ushr 8) and 0xFF).toByte()
        pkt[17] = (srcIp and 0xFF).toByte()
        pkt[18] = ((dstIp ushr 24) and 0xFF).toByte()
        pkt[19] = ((dstIp ushr 16) and 0xFF).toByte()
        pkt[20] = ((dstIp ushr 8) and 0xFF).toByte()
        pkt[21] = (dstIp and 0xFF).toByte()

        // TCP header — 20 bytes at offset 20
        val tcpOffset = IPV4_HEADER_MIN
        pkt[tcpOffset] = ((srcPort ushr 8) and 0xFF).toByte()
        pkt[tcpOffset + 1] = (srcPort and 0xFF).toByte()
        pkt[tcpOffset + 2] = ((dstPort ushr 8) and 0xFF).toByte()
        pkt[tcpOffset + 3] = (dstPort and 0xFF).toByte()
        // pkt[tcpOffset + 4..7] sequence number
        pkt[tcpOffset + 4] = ((seq ushr 24) and 0xFF).toByte()
        pkt[tcpOffset + 5] = ((seq ushr 16) and 0xFF).toByte()
        pkt[tcpOffset + 6] = ((seq ushr 8) and 0xFF).toByte()
        pkt[tcpOffset + 7] = (seq and 0xFF).toByte()
        // pkt[tcpOffset + 8..11] acknowledgement number
        pkt[tcpOffset + 8] = ((ack ushr 24) and 0xFF).toByte()
        pkt[tcpOffset + 9] = ((ack ushr 16) and 0xFF).toByte()
        pkt[tcpOffset + 10] = ((ack ushr 8) and 0xFF).toByte()
        pkt[tcpOffset + 11] = (ack and 0xFF).toByte()
        pkt[tcpOffset + 12] = (((tcpHeaderLen / 4) shl 4)).toByte()  // data offset
        pkt[tcpOffset + 13] = flags.toByte()                          // flags
        pkt[tcpOffset + 14] = ((window ushr 8) and 0xFF).toByte()     // window hi
        pkt[tcpOffset + 15] = (window and 0xFF).toByte()              // window lo
        // pkt[tcpOffset + 16..17] checksum = 0 (filled below)
        // pkt[tcpOffset + 18..19] urgent pointer = 0

        // Copy payload after TCP header
        if (payloadLen > 0 && payload != null) {
            System.arraycopy(payload, 0, pkt, tcpOffset + tcpHeaderLen, payloadLen)
        }

        // Fill TCP checksum
        val tcpChecksum = tcpChecksum(pkt, tcpOffset, tcpHeaderLen + payloadLen, srcIp, dstIp)
        pkt[tcpOffset + 16] = (tcpChecksum ushr 8).toByte()
        pkt[tcpOffset + 17] = (tcpChecksum and 0xFF).toByte()

        // Fill IP header checksum
        val ipChecksum = ipChecksum(pkt, IPV4_HEADER_MIN)
        pkt[12] = (ipChecksum ushr 8).toByte()
        pkt[13] = (ipChecksum and 0xFF).toByte()

        return pkt
    }

    private fun ipChecksum(buf: ByteArray, len: Int): Int {
        var sum = 0L
        var i = 0
        while (i + 1 < len) {
            sum += ((buf[i].toInt() and 0xFF) shl 8) or (buf[i + 1].toInt() and 0xFF)
            i += 2
        }
        if (i < len) {
            sum += (buf[i].toInt() and 0xFF) shl 8
        }
        while (sum shr 16 != 0L) {
            sum = (sum and 0xFFFF) + (sum shr 16)
        }
        return (sum.inv() and 0xFFFF).toInt()
    }

    private fun tcpChecksum(
        buf: ByteArray,
        tcpOffset: Int,
        tcpLen: Int,
        srcIp: Int,
        dstIp: Int
    ): Int {
        var sum = 0L
        sum += (srcIp ushr 16) and 0xFFFF
        sum += srcIp and 0xFFFF
        sum += (dstIp ushr 16) and 0xFFFF
        sum += dstIp and 0xFFFF
        sum += IP_PROTO_TCP.toLong()
        sum += tcpLen.toLong()
        var i = tcpOffset
        val end = tcpOffset + tcpLen
        while (i + 1 < end) {
            sum += ((buf[i].toInt() and 0xFF) shl 8) or (buf[i + 1].toInt() and 0xFF)
            i += 2
        }
        if (i < end) {
            sum += (buf[i].toInt() and 0xFF) shl 8
        }
        while (sum shr 16 != 0L) {
            sum = (sum and 0xFFFF) + (sum shr 16)
        }
        return (sum.inv() and 0xFFFF).toInt()
    }

    private fun streamKey(srcIp: Int, srcPort: Int, dstIp: Int, dstPort: Int): String {
        return "$srcIp:$srcPort->$dstIp:$dstPort"
    }

    private fun ipToInt(buf: ByteArray, offset: Int): Int {
        return ((buf[offset].toInt() and 0xFF) shl 24) or
            ((buf[offset + 1].toInt() and 0xFF) shl 16) or
            ((buf[offset + 2].toInt() and 0xFF) shl 8) or
            (buf[offset + 3].toInt() and 0xFF)
    }

    @Suppress("unused")
    private fun ipToInt(addr: String): Int {
        return try {
            val bytes = InetAddress.getByName(addr) as Inet4Address
            ByteBuffer.wrap(bytes.address).int
        } catch (e: Exception) {
            0
        }
    }

    private fun intToIp(value: Int): String {
        return "${(value ushr 24) and 0xFF}.${(value ushr 16) and 0xFF}.${(value ushr 8) and 0xFF}.${value and 0xFF}"
    }

    private fun readUint32(buf: ByteArray, offset: Int): Int {
        return ((buf[offset].toInt() and 0xFF) shl 24) or
            ((buf[offset + 1].toInt() and 0xFF) shl 16) or
            ((buf[offset + 2].toInt() and 0xFF) shl 8) or
            (buf[offset + 3].toInt() and 0xFF)
    }

    fun addRoutes(newRoutes: ArrayList<String>): Boolean {
        if (!isRunning || vpnInterface == null) {
            Log.w(TAG, "Cannot add routes: VPN not running")
            return false
        }

        val currentAddress = lastIntent?.getStringExtra("tunnelAddress") ?: "100.64.0.2"
        val currentMask = lastIntent?.getStringExtra("subnetMask") ?: "255.255.255.0"
        val currentMtu = lastIntent?.getIntExtra("mtu", 1280) ?: 1280
        val currentDns = lastIntent?.getStringArrayListExtra("dnsServers") ?: arrayListOf("8.8.8.8", "1.1.1.1")
        val currentRoutes = lastIntent?.getStringArrayListExtra("routes") ?: arrayListOf("100.64.0.0/24")

        val mergedRoutes = ArrayList(currentRoutes)
        for (route in newRoutes) {
            if (!mergedRoutes.contains(route)) {
                mergedRoutes.add(route)
            }
        }

        lastIntent?.putStringArrayListExtra("routes", mergedRoutes)

        stopVpnInternal()
        startVpn(currentAddress, currentMask, currentMtu, mergedRoutes, currentDns)
        Log.i(TAG, "VPN routes updated: $mergedRoutes")
        return true
    }

    private fun stopVpnInternal() {
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
        streams.clear()
        streamKeyIndex.clear()
    }

    private fun stopVpn() {
        stopVpnInternal()
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

    private fun buildNotification(contentText: String = "异地组网连接中"): Notification {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("CloudDock VPN")
            .setContentText(contentText)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    private data class TcpStream(
        val streamId: String,
        val srcIp: Int,
        val srcPort: Int,
        val dstIp: Int,
        val dstPort: Int,
        var localSeq: Int,
        var remoteSeq: Int,
        var remoteWindow: Int
    )
}

private const val IPV4_HEADER_MIN = 20
private const val TCP_HEADER_MIN = 20
private const val IP_PROTO_TCP = 6
private const val TCP_FIN = 0x01
private const val TCP_SYN = 0x02
private const val TCP_RST = 0x04
private const val TCP_PSH = 0x08
private const val TCP_ACK = 0x10
