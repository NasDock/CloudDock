import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { CloudDockVPNBridge } = NativeModules;

if (!CloudDockVPNBridge) {
  throw new Error(
    'CloudDockVPNBridge native module is not available. ' +
      'Please ensure the native module is properly linked.'
  );
}

const eventEmitter = new NativeEventEmitter(CloudDockVPNBridge);

export interface VPNConfig {
  tunnelAddress: string;
  subnetMask?: string;
  mtu?: number;
  dnsServers?: string[];
  routes?: string[];
}

export type VPNStatus = 'connected' | 'connecting' | 'disconnecting' | 'disconnected' | 'invalid';

/**
 * Start the VPN tunnel with the given configuration.
 */
export async function startVPN(config: VPNConfig): Promise<{ success: boolean }> {
  return CloudDockVPNBridge.startVPN({
    subnetMask: '255.255.255.0',
    mtu: 1280,
    dnsServers: ['8.8.8.8', '1.1.1.1'],
    routes: ['100.64.0.0/24'],
    ...config,
  });
}

/**
 * Stop the VPN tunnel.
 */
export async function stopVPN(): Promise<{ success: boolean }> {
  return CloudDockVPNBridge.stopVPN();
}

/**
 * Get the current VPN status.
 */
export async function getVPNStatus(): Promise<{ status: VPNStatus }> {
  return CloudDockVPNBridge.getStatus();
}

/**
 * Send a raw IP packet (base64-encoded) to the VPN tunnel.
 */
export async function sendVPNPacket(packetBase64: string): Promise<{ success: boolean }> {
  return CloudDockVPNBridge.sendPacket(packetBase64);
}

/**
 * Subscribe to VPN status changes.
 */
export function addVPNStatusListener(callback: (status: VPNStatus) => void): () => void {
  const subscription = eventEmitter.addListener(
    'vpnStatusChanged',
    (event: { status: VPNStatus }) => {
      callback(event.status);
    }
  );
  return () => subscription.remove();
}

/**
 * Subscribe to incoming VPN packets.
 */
export function addVPNPacketListener(callback: (packetBase64: string) => void): () => void {
  const subscription = eventEmitter.addListener('vpnPacketReceived', (packetBase64: string) => {
    callback(packetBase64);
  });
  return () => subscription.remove();
}

/**
 * iOS only: check if VPN permission has been granted.
 * On Android, use VpnService.prepare() via a native bridge call.
 */
export async function checkVPNPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    // iOS NETunnelProviderManager.loadAllFromPreferences will tell us
    // indirectly if the profile is enabled. For now we just check status.
    const { status } = await getVPNStatus();
    return status !== 'invalid';
  }
  // Android: permission check is done in startVPN
  return true;
}
