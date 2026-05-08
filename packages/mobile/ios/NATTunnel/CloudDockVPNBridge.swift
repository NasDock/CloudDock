import Foundation
import React

@objc(CloudDockVPNBridge)
class CloudDockVPNBridge: RCTEventEmitter {

  private var hasListeners = false

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return ["vpnStatusChanged", "vpnPacketReceived"]
  }

  override func startObserving() {
    hasListeners = true
    CloudDockVPNManager.shared.onPacketReceived = { [weak self] packet in
      guard let self = self, self.hasListeners else { return }
      self.sendEvent(withName: "vpnPacketReceived", body: packet.base64EncodedString())
    }

    NotificationCenter.default.addObserver(
      self,
      selector: #selector(statusChanged),
      name: NSNotification.Name.NEVPNStatusDidChange,
      object: nil
    )
  }

  override func stopObserving() {
    hasListeners = false
    CloudDockVPNManager.shared.onPacketReceived = nil
    NotificationCenter.default.removeObserver(self)
  }

  @objc func statusChanged() {
    guard hasListeners else { return }
    let status = CloudDockVPNManager.shared.getStatus()
    sendEvent(withName: "vpnStatusChanged", body: ["status": status])
  }

  @objc func startVPN(
    _ config: [String: Any],
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let tunnelAddress = config["tunnelAddress"] as? String,
          let subnetMask = config["subnetMask"] as? String else {
      reject("INVALID_CONFIG", "Missing tunnelAddress or subnetMask", nil)
      return
    }
    let mtu = config["mtu"] as? NSNumber ?? 1280
    let dnsServers = config["dnsServers"] as? [String]
    let routes = config["routes"] as? [String]

    CloudDockVPNManager.shared.startVPN(
      tunnelAddress: tunnelAddress,
      subnetMask: subnetMask,
      mtu: mtu,
      dnsServers: dnsServers,
      routes: routes
    ) { success, error in
      if let error = error {
        reject("START_FAILED", error.localizedDescription, error)
      } else {
        resolve(["success": success])
      }
    }
  }

  @objc func stopVPN(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    CloudDockVPNManager.shared.stopVPN { success in
      resolve(["success": success])
    }
  }

  @objc func getStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(["status": CloudDockVPNManager.shared.getStatus()])
  }

  @objc func sendPacket(
    _ packetBase64: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let packet = Data(base64Encoded: packetBase64) else {
      reject("INVALID_PACKET", "Failed to decode base64 packet", nil)
      return
    }
    CloudDockVPNManager.shared.sendPacket(packet)
    resolve(["success": true])
  }
}
