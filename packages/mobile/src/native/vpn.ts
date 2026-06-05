import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

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

export interface ProxyConnectEvent {
  streamId: string;
  host: string;
  port: number;
}

export interface ProxyDataEvent {
  streamId: string;
  data: string; // base64
}

export interface ProxyCloseEvent {
  streamId: string;
}

/**
 * Start the VPN tunnel with the given configuration.
 */
export async function requestVPNPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (!CloudDockVPNBridge.requestPermission) return true;
  return CloudDockVPNBridge.requestPermission();
}

export async function startVPN(config: VPNConfig): Promise<{ success: boolean }> {
  return CloudDockVPNBridge.startVPN({
    subnetMask: '255.255.255.0',
    mtu: 1280,
    dnsServers: ['8.8.8.8', '1.1.1.1'],
    routes: ['100.64.0.0/24'],
    ...config,
  });
}

export async function stopVPN(): Promise<{ success: boolean }> {
  return CloudDockVPNBridge.stopVPN();
}

export async function getVPNStatus(): Promise<{ status: VPNStatus }> {
  return CloudDockVPNBridge.getStatus();
}

/**
 * Proxy mode: write a payload (received from the remote ProxyServer) into
 * the local TCP stream identified by [streamId]. The native side frames it
 * into an IP+TCP packet and writes it to the TUN.
 */
export async function sendProxyPacket(streamId: string, dataBase64: string): Promise<{ success: boolean }> {
  return CloudDockVPNBridge.sendProxyPacket(streamId, dataBase64);
}

/** Proxy mode: close a local TCP stream (send FIN). */
export async function closeProxyStream(streamId: string): Promise<{ success: boolean }> {
  return CloudDockVPNBridge.closeProxyStream(streamId);
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
 * Subscribe to a new TCP stream the VpnService identified (SYN seen).
 */
export function addProxyConnectListener(callback: (event: ProxyConnectEvent) => void): () => void {
  const subscription = eventEmitter.addListener('vpnProxyConnect', callback);
  return () => subscription.remove();
}

/**
 * Subscribe to data payloads from a local TCP stream.
 */
export function addProxyDataListener(callback: (event: ProxyDataEvent) => void): () => void {
  const subscription = eventEmitter.addListener('vpnProxyData', callback);
  return () => subscription.remove();
}

/**
 * Subscribe to half-close / reset notifications for a TCP stream.
 */
export function addProxyCloseListener(callback: (event: ProxyCloseEvent) => void): () => void {
  const subscription = eventEmitter.addListener('vpnProxyClose', callback);
  return () => subscription.remove();
}

/**
 * iOS only: check if VPN permission has been granted.
 * On Android, use VpnService.prepare() via a native bridge call.
 */
export async function checkVPNPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const { status } = await getVPNStatus();
    return status !== 'invalid';
  }
  return true;
}

/**
 * Add additional routes to an already-running VPN tunnel.
 */
export async function addVPNRoutes(routes: string[]): Promise<{ success: boolean }> {
  if (Platform.OS === 'android' && CloudDockVPNBridge.addRoutes) {
    return CloudDockVPNBridge.addRoutes(routes);
  }
  return { success: false };
}
