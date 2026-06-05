import { create } from 'zustand';
import {
  startVPN,
  stopVPN,
  getVPNStatus,
  addVPNStatusListener,
  addVPNPacketListener,
  sendVPNPacket,
  requestVPNPermission,
} from '../native/vpn';
import {
  sendIPPacket,
  sendProxyConnect,
  sendProxyData,
  sendProxyClose,
  setIPPacketHandler,
  setProxyConnectHandler,
  setProxyDataHandler,
  setProxyCloseHandler,
  setProxyErrorHandler,
  setConnectionStateHandler,
  setVPNControlHandler,
  isWebRTCReady,
} from '../webrtc';
import { ProxyClient } from '../network/proxy-client';

export type VPNStatus = 'idle' | 'connecting' | 'connected' | 'failed';

interface VPNStats {
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
}

interface VPNState {
  status: VPNStatus;
  virtualIp: string;
  nasVirtualIp: string;
  stats: VPNStats;
  error: string | null;

  // Actions
  startVPN: () => Promise<void>;
  stopVPN: () => Promise<void>;
  toggleVPN: () => Promise<void>;
  resetError: () => void;
}

export const useVPNStore = create<VPNState>((set, get) => ({
  status: 'idle',
  virtualIp: '100.64.0.2',
  nasVirtualIp: '100.64.0.1',
  stats: { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 },
  error: null,

  startVPN: async () => {
    set({ status: 'connecting', error: null });
    try {
      const permissionGranted = await requestVPNPermission();
      if (!permissionGranted) {
        throw new Error('VPN permission not granted');
      }

      // Include common private subnets so iOS can route to NAS LAN devices.
      // iOS does not support dynamic route updates, so we must declare them upfront.
      await startVPN({
        tunnelAddress: get().virtualIp,
        subnetMask: '255.255.255.0',
        mtu: 1280,
        routes: [
          '100.64.0.0/24',   // VPN mesh subnet
          '192.168.0.0/16',  // Common home LAN
          '10.0.0.0/8',      // Common corporate LAN
          '172.16.0.0/12',   // Docker / other private
        ],
        dnsServers: ['8.8.8.8', '1.1.1.1'],
      });

      // Create proxy client for new proxy mode
      const proxyClient = new ProxyClient({
        onProxyConnect: (streamId, host, port) => {
          sendProxyConnect(streamId, host, port);
        },
        onProxyData: (streamId, data) => {
          sendProxyData(streamId, data);
        },
        onProxyClose: (streamId) => {
          sendProxyClose(streamId);
        },
      });

      // Wire proxy client events back to native VPN
      proxyClient.on('data', (streamId: string, data: ArrayBuffer) => {
        // Forward data from NAS back to native VPN
        const bytes = new Uint8Array(data);
        let binaryString = '';
        for (let i = 0; i < bytes.length; i++) {
          binaryString += String.fromCharCode(bytes[i] ?? 0);
        }
        const base64 = btoa(binaryString);
        sendVPNPacket(base64).catch(() => {});
      });

      proxyClient.on('close', (streamId: string) => {
        // Stream closed by NAS
      });

      // Setup WebRTC proxy handlers
      setProxyConnectHandler((msg) => {
        // NAS confirms connection (or we could initiate from mobile side)
        // For now, mobile initiates via native VPN events
      });
      setProxyDataHandler((msg) => {
        proxyClient.handleRemoteData(msg.streamId, msg.data);
      });
      setProxyCloseHandler((msg) => {
        proxyClient.handleRemoteClose(msg.streamId);
      });
      setProxyErrorHandler((msg) => {
        console.warn('[vpn] Proxy error from NAS', msg.streamId, msg.message);
        proxyClient.handleRemoteClose(msg.streamId);
      });

      // Legacy: Setup packet routing: VPN → WebRTC (IP packet mode)
      const unsubscribePacket = addVPNPacketListener((packetBase64) => {
        const state = get();
        const packetSize = Math.ceil(packetBase64.length * 0.75); // approximate base64 decoded size
        set({
          stats: {
            ...state.stats,
            bytesOut: state.stats.bytesOut + packetSize,
            packetsOut: state.stats.packetsOut + 1,
          },
        });

        if (isWebRTCReady()) {
          const binaryString = atob(packetBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const sent = sendIPPacket(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
          if (!sent) {
            console.warn('[vpn] sendIPPacket returned false, packet may be dropped');
          }
        } else {
          // WebRTC not ready — packets cannot be forwarded
          console.warn('[vpn] WebRTC not ready, packet dropped');
        }
      });

      // Legacy: Setup packet routing: WebRTC → VPN
      setIPPacketHandler((packet) => {
        const state = get();
        set({
          stats: {
            ...state.stats,
            bytesIn: state.stats.bytesIn + packet.byteLength,
            packetsIn: state.stats.packetsIn + 1,
          },
        });

        const bytes = new Uint8Array(packet);
        let binaryString = '';
        for (let i = 0; i < bytes.length; i++) {
          binaryString += String.fromCharCode(bytes[i] ?? 0);
        }
        const base64 = btoa(binaryString);
        sendVPNPacket(base64).catch(() => {});
      });

      // Monitor P2P connection state
      setConnectionStateHandler((state) => {
        const current = get();
        if (state === 'connected') {
          if (current.status === 'connected' && current.error?.includes('P2P')) {
            set({ error: null });
          }
        } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          // WebRTC disconnected → VPN is effectively down
          set({ status: 'failed', error: 'P2P 连接已断开，组网不可用' });
        }
      });

      // Handle VPN control messages from NAS (e.g. route updates)
      setVPNControlHandler((msg: any) => {
        if (msg?.action === 'route_update' && msg?.payload?.routes) {
          const newRoutes = msg.payload.routes as string[];
          console.info('[vpn] Received route update from NAS', newRoutes);
          // Dynamically add routes to the VPN tunnel
          import('../native/vpn').then(({ addVPNRoutes }) => {
            addVPNRoutes(newRoutes).then((result) => {
              if (result.success) {
                console.info('[vpn] Routes added successfully', newRoutes);
              } else {
                console.warn('[vpn] Failed to add routes dynamically', newRoutes);
              }
            }).catch((err) => {
              console.warn('[vpn] Error adding routes', err);
            });
          });
        }
      });

      // Wait for WebRTC to be ready before marking as connected
      const waitForWebRTC = async (): Promise<boolean> => {
        for (let i = 0; i < 150; i++) {
          if (isWebRTCReady()) return true;
          await new Promise((r) => setTimeout(r, 200));
        }
        return false;
      };

      const webRTCReady = await waitForWebRTC();
      if (!webRTCReady) {
        throw new Error('P2P 连接超时，无法建立组网');
      }

      set({ status: 'connected' });

      // Listen for VPN status changes
      const unsubscribeStatus = addVPNStatusListener((vpnStatus) => {
        if (vpnStatus === 'disconnected') {
          unsubscribePacket();
          unsubscribeStatus();
          proxyClient.closeAll();
          set({ status: 'idle' });
        }
      });
    } catch (err: any) {
      set({ status: 'failed', error: err?.message || 'VPN start failed' });
    }
  },

  stopVPN: async () => {
    try {
      await stopVPN();
      set({ status: 'idle' });
    } catch (err: any) {
      set({ status: 'failed', error: err?.message || 'VPN stop failed' });
    }
  },

  toggleVPN: async () => {
    const { status } = get();
    if (status === 'connected' || status === 'connecting') {
      await get().stopVPN();
    } else {
      await get().startVPN();
    }
  },

  resetError: () => {
    set({ error: null });
  },
}));
