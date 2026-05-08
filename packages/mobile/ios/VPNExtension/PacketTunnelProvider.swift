import NetworkExtension
import Network

class PacketTunnelProvider: NEPacketTunnelProvider {

    private var isRunning = false
    private var listener: NWListener?
    private var connection: NWConnection?
    private let localPort: UInt16 = 53791 // fixed loopback port for IPC

    override func startTunnel(options: [String : NSObject]?, completionHandler: @escaping (Error?) -> Void) {
        guard let options = options,
              let tunnelAddress = options["tunnelAddress"] as? String,
              let tunnelSubnetMask = options["tunnelSubnetMask"] as? String,
              let tunnelMTU = options["tunnelMTU"] as? NSNumber else {
            completionHandler(NSError(domain: "VPNExtension", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing tunnel configuration"]))
            return
        }

        let virtualIP = tunnelAddress
        let subnetMask = tunnelSubnetMask
        let mtu = tunnelMTU.intValue

        let settings = NEPacketTunnelNetworkSettings(tunnelRemoteAddress: "127.0.0.1")
        settings.ipv4Settings = NEIPv4Settings(addresses: [virtualIP], subnetMasks: [subnetMask])

        // Split tunneling: only route specified subnets through VPN
        if let routeStrings = options["routes"] as? [String] {
            let routes = routeStrings.compactMap { parseCIDR($0) }
            settings.ipv4Settings?.includedRoutes = routes.isEmpty ? [NEIPv4Route.default()] : routes
        } else {
            settings.ipv4Settings?.includedRoutes = [NEIPv4Route.default()]
        }

        settings.mtu = NSNumber(value: mtu)

        if let dnsServers = options["dnsServers"] as? [String] {
            settings.dnsSettings = NEDNSSettings(servers: dnsServers)
        }

        setTunnelNetworkSettings(settings) { [weak self] error in
            if let error = error {
                completionHandler(error)
                return
            }
            self?.isRunning = true
            self?.startIPCSocket()
            self?.startReadingPackets()
            completionHandler(nil)
        }
    }

    private func parseCIDR(_ cidr: String) -> NEIPv4Route? {
        let parts = cidr.split(separator: "/")
        guard parts.count == 2,
              let prefixLength = Int(parts[1]) else { return nil }
        return NEIPv4Route(destinationAddress: String(parts[0]), subnetMask: prefixToMask(prefixLength))
    }

    private func prefixToMask(_ prefix: Int) -> String {
        var mask = UInt32(0)
        for i in 0..<prefix {
            mask |= (1 << (31 - i))
        }
        let octets = [
            (mask >> 24) & 0xFF,
            (mask >> 16) & 0xFF,
            (mask >> 8) & 0xFF,
            mask & 0xFF
        ]
        return octets.map { String($0) }.joined(separator: ".")
    }

    override func stopTunnel(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        isRunning = false
        connection?.cancel()
        listener?.cancel()
        connection = nil
        listener = nil
        completionHandler()
    }

    private func startIPCSocket() {
        do {
            let params = NWParameters.tcp
            params.allowLocalOnly = true
            listener = try NWListener(using: params, on: NWEndpoint.Port(integerLiteral: localPort))
        } catch {
            NSLog("[VPNExtension] failed to create listener: \(error)")
            return
        }

        listener?.newConnectionHandler = { [weak self] newConnection in
            self?.connection?.cancel()
            self?.connection = newConnection
            newConnection.start(queue: .global(qos: .utility))
            self?.startReceivingFromConnection()
        }

        listener?.stateUpdateHandler = { state in
            if case .failed(let error) = state {
                NSLog("[VPNExtension] listener failed: \(error)")
            }
        }

        listener?.start(queue: .global(qos: .utility))
    }

    private func startReceivingFromConnection() {
        guard let connection = connection else { return }
        readNextPacket(from: connection)
    }

    private func readNextPacket(from connection: NWConnection) {
        // Frame: 4-byte big-endian length + raw IP packet
        connection.receive(minimumIncompleteLength: 4, maximumLength: 4) { [weak self] data, _, isComplete, error in
            guard let self = self, self.isRunning else { return }
            if let error = error {
                NSLog("[VPNExtension] receive length error: \(error)")
                return
            }
            guard let data = data, data.count == 4 else {
                if isComplete { return }
                self.readNextPacket(from: connection)
                return
            }
            let length = data.withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }
            connection.receive(minimumIncompleteLength: Int(length), maximumLength: Int(length)) { [weak self] packetData, _, isComplete, error in
                guard let self = self, self.isRunning else { return }
                if let error = error {
                    NSLog("[VPNExtension] receive packet error: \(error)")
                    return
                }
                if let packetData = packetData {
                    self.packetFlow.writePackets([packetData], withProtocols: [AF_INET as NSNumber])
                }
                if !isComplete {
                    self.readNextPacket(from: connection)
                }
            }
        }
    }

    private func startReadingPackets() {
        DispatchQueue.global(qos: .utility).async { [weak self] in
            while self?.isRunning == true {
                autoreleasepool {
                    let sem = DispatchSemaphore(value: 0)
                    self?.packetFlow.readPackets { [weak self] packets, protocols in
                        for packet in packets {
                            self?.sendPacketToConnection(packet)
                        }
                        sem.signal()
                    }
                    sem.wait()
                }
            }
        }
    }

    private func sendPacketToConnection(_ packet: Data) {
        guard let connection = connection else { return }
        var length = UInt32(packet.count).bigEndian
        let framed = Data(bytes: &length, count: 4) + packet
        connection.send(content: framed, completion: .contentProcessed { _ in })
    }
}
