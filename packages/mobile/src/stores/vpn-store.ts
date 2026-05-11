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
  setIPPacketHandler,
  setConnectionStateHandler,
  isWebRTCReady,
} from '../webrtc';

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

      await startVPN({
        tunnelAddress: get().virtualIp,
        subnetMask: '255.255.255.0',
        mtu: 1280,
        routes: ['100.64.0.0/24'],
        dnsServers: ['8.8.8.8', '1.1.1.1'],
      });

      // Setup packet routing: VPN → WebRTC
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
          sendIPPacket(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
        } else {
          // Phase 5: fallback to WebSocket tunnel binary mode
          // For now, packets are dropped when P2P is not ready
          console.warn('[vpn] WebRTC not ready, packet dropped (fallback not yet implemented)');
        }
      });

      // Setup packet routing: WebRTC → VPN
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
        } else if (state === 'failed' || state === 'disconnected') {
          if (current.status === 'connected') {
            set({
              error: 'P2P 连接已断开，正在尝试重连...',
            });
          }
        }
      });

      set({ status: 'connected' });

      // Listen for VPN status changes
      const unsubscribeStatus = addVPNStatusListener((vpnStatus) => {
        if (vpnStatus === 'disconnected') {
          unsubscribePacket();
          unsubscribeStatus();
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
