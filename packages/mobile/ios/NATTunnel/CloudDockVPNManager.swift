import NetworkExtension
import Foundation

@objc(CloudDockVPNManager)
class CloudDockVPNManager: NSObject {

  static let shared = CloudDockVPNManager()

  private var manager: NETunnelProviderManager?
  private var session: NETunnelProviderSession? {
    return manager?.connection as? NETunnelProviderSession
  }

  @objc var onPacketReceived: ((Data) -> Void)?

  private var ipcConnection: NWConnection?
  private let localPort: UInt16 = 53791

  @objc func loadManager(_ completion: @escaping (Bool, Error?) -> Void) {
    NETunnelProviderManager.loadAllFromPreferences { [weak self] managers, error in
      if let error = error {
        completion(false, error)
        return
      }

      if let existing = managers?.first {
        self?.manager = existing
        completion(true, nil)
        return
      }

      // Create new manager
      let newManager = NETunnelProviderManager()
      let proto = NETunnelProviderProtocol()
      proto.providerBundleIdentifier = "com.clouddock.app.VPNExtension"
      proto.serverAddress = "127.0.0.1"
      proto.providerConfiguration = [:]
      newManager.protocolConfiguration = proto
      newManager.localizedDescription = "CloudDock VPN"
      newManager.isEnabled = true

      newManager.saveToPreferences { error in
        if let error = error {
          completion(false, error)
          return
        }
        newManager.loadFromPreferences { error in
          self?.manager = newManager
          completion(error == nil, error)
        }
      }
    }
  }

  @objc func startVPN(
    tunnelAddress: String,
    subnetMask: String,
    mtu: NSNumber,
    dnsServers: [String]?,
    routes: [String]?,
    completion: @escaping (Bool, Error?) -> Void
  ) {
    loadManager { [weak self] success, error in
      guard success else {
        completion(false, error)
        return
      }

      guard let session = self?.session else {
        completion(false, NSError(domain: "CloudDockVPN", code: 2, userInfo: [NSLocalizedDescriptionKey: "No session"]))
        return
      }

      if session.status == .connected || session.status == .connecting {
        completion(true, nil)
        return
      }

      var options: [String: NSObject] = [
        "tunnelAddress": tunnelAddress as NSString,
        "tunnelSubnetMask": subnetMask as NSString,
        "tunnelMTU": mtu
      ]
      if let dns = dnsServers {
        options["dnsServers"] = dns as NSArray
      }
      if let routes = routes {
        options["routes"] = routes as NSArray
      }

      do {
        try session.startTunnel(options: options)
        self?.waitForConnection { connected in
          if connected {
            self?.connectIPC()
          }
          completion(connected, nil)
        }
      } catch {
        completion(false, error)
      }
    }
  }

  @objc func stopVPN(_ completion: @escaping (Bool) -> Void) {
    guard let session = session else {
      completion(false)
      return
    }
    ipcConnection?.cancel()
    ipcConnection = nil
    session.stopTunnel()
    completion(true)
  }

  @objc func getStatus() -> String {
    switch session?.status {
    case .connected: return "connected"
    case .connecting: return "connecting"
    case .disconnecting: return "disconnecting"
    case .invalid: return "invalid"
    default: return "disconnected"
    }
  }

  @objc func sendPacket(_ packet: Data) {
    guard let conn = ipcConnection else { return }
    var length = UInt32(packet.count).bigEndian
    let framed = Data(bytes: &length, count: 4) + packet
    conn.send(content: framed, completion: .contentProcessed { _ in })
  }

  private func waitForConnection(completion: @escaping (Bool) -> Void) {
    var attempts = 0
    let timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] timer in
      attempts += 1
      if self?.session?.status == .connected {
        timer.invalidate()
        completion(true)
      } else if attempts > 30 {
        timer.invalidate()
        completion(false)
      }
    }
    RunLoop.current.add(timer, forMode: .common)
  }

  private func connectIPC() {
    let endpoint = NWEndpoint.hostPort(host: .ipv4(.loopback), port: .init(integerLiteral: localPort))
    let params = NWParameters.tcp
    params.allowLocalOnly = true
    let conn = NWConnection(to: endpoint, using: params)
    self.ipcConnection = conn

    conn.stateUpdateHandler = { [weak self] state in
      if case .ready = state {
        self?.startReceivingIPCPackets()
      }
    }
    conn.start(queue: .global(qos: .utility))
  }

  private func startReceivingIPCPackets() {
    guard let conn = ipcConnection else { return }
    readNextPacket(from: conn)
  }

  private func readNextPacket(from connection: NWConnection) {
    connection.receive(minimumIncompleteLength: 4, maximumLength: 4) { [weak self] data, _, isComplete, error in
      guard let self = self else { return }
      if let error = error {
        NSLog("[CloudDockVPNManager] receive length error: \(error)")
        return
      }
      guard let data = data, data.count == 4 else {
        if !isComplete { self.readNextPacket(from: connection) }
        return
      }
      let length = data.withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }
      connection.receive(minimumIncompleteLength: Int(length), maximumLength: Int(length)) { [weak self] packetData, _, isComplete, error in
        guard let self = self else { return }
        if let error = error {
          NSLog("[CloudDockVPNManager] receive packet error: \(error)")
          return
        }
        if let packetData = packetData {
          self.onPacketReceived?(packetData)
        }
        if !isComplete {
          self.readNextPacket(from: connection)
        }
      }
    }
  }
}
