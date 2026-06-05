import axios from 'axios';
import { WebRTCManager } from './webrtc-manager';
import { ProxyClient } from './proxy-client';
import { createVPNEngine, VPNEngine, VPNConfig } from '../vpn/vpn-engine';
import { configStore, desktopDeviceId, desktopDeviceName, desktopDevicePlatform } from '../stores/desktop-config';

export type VPNStatus = 'idle' | 'connecting' | 'connected' | 'failed';

interface NASClient {
  clientId: string;
  name: string;
  status: 'online' | 'offline' | 'pending' | 'error';
  enabled?: boolean;
}

export class CloudDockDesktopClient {
  private vpnEngine: VPNEngine;
  private webrtcManager?: WebRTCManager | undefined;
  private proxyClient?: ProxyClient | undefined;
  private status: VPNStatus = 'idle';
  private virtualIp = '100.64.0.3';
  private nasVirtualIp = '100.64.0.1';
  private statsTimer?: ReturnType<typeof setInterval> | undefined;

  onVPNStatusChange?: () => void;
  onVPNStatsUpdate?: () => void;

  constructor() {
    this.vpnEngine = createVPNEngine();
    this.vpnEngine.onPacketReceived = (packet) => {
      this.handleVPNPacket(packet);
    };
  }

  getProxyPort(): number | undefined {
    // TODO: return actual proxy port once ProxyClient.start() resolves
    return undefined;
  }

  getVPNStatus(): VPNStatus {
    return this.status;
  }

  getVPNStats(): { bytesIn: number; bytesOut: number } {
    const stats = this.vpnEngine.getStats();
    return { bytesIn: stats.bytesIn, bytesOut: stats.bytesOut };
  }

  async startVPN(): Promise<void> {
    if (this.status === 'connected' || this.status === 'connecting') return;
    this.status = 'connecting';
    this.onVPNStatusChange?.();

    try {
      // VPN Engine (TUN mode) is disabled by default to avoid TCP over TCP issues.
      // Use WebRTC proxy mode instead. Uncomment to re-enable legacy TUN mode.
      // const config: VPNConfig = {
      //   address: this.virtualIp,
      //   subnetMask: '255.255.255.0',
      //   mtu: 1280,
      //   routes: ['100.64.0.0/24'],
      //   dnsServers: ['8.8.8.8', '1.1.1.1'],
      // };
      // await this.vpnEngine.start(config);

      const token = configStore.get('accessToken');
      if (!token) {
        console.warn('[desktop] No access token available');
        this.status = 'failed';
        this.onVPNStatusChange?.();
        return;
      }

      const serverUrl = configStore.get('serverUrl');
      const deviceId = await this.discoverNASDevice(serverUrl, token);
      if (!deviceId) {
        console.warn('[desktop] No online NAS device found');
        this.status = 'failed';
        this.onVPNStatusChange?.();
        return;
      }

      configStore.set('lastDeviceId', deviceId);

      this.webrtcManager = new WebRTCManager({ serverUrl, deviceId, token });

      // Legacy TUN mode callbacks
      // Legacy TUN mode callbacks (disabled)
      this.webrtcManager.onIPPacketReceived = (packet) => {
        // TUN mode disabled — use proxy mode instead
        // this.vpnEngine.sendPacket(packet);
      };

      // New proxy mode callbacks
      this.proxyClient = new ProxyClient({
        onProxyConnect: (streamId, host, port) => {
          this.webrtcManager?.sendProxyConnect(streamId, host, port).catch(() => {});
        },
        onProxyData: (streamId, data) => {
          this.webrtcManager?.sendProxyData(streamId, data).catch(() => {});
        },
        onProxyClose: (streamId) => {
          this.webrtcManager?.sendProxyClose(streamId).catch(() => {});
        },
      });
      this.proxyClient.start().then((port) => {
        console.info('[desktop] Proxy client listening on 127.0.0.1:' + port);
      }).catch((err) => {
        console.warn('[desktop] Proxy client failed to start', err);
      });

      this.webrtcManager.onProxyDataReceived = (msg) => {
        this.proxyClient?.handleRemoteData(msg.streamId, msg.data);
      };
      this.webrtcManager.onProxyCloseReceived = (msg) => {
        this.proxyClient?.handleRemoteClose(msg.streamId);
      };
      this.webrtcManager.onProxyErrorReceived = (msg) => {
        console.warn('[desktop] Proxy error from NAS', msg.streamId, msg.message);
        this.proxyClient?.handleRemoteClose(msg.streamId);
      };

      this.webrtcManager.onConnectionStateChange = (state) => {
        if (state === 'connected') {
          if (this.status !== 'connected') {
            this.status = 'connected';
            this.onVPNStatusChange?.();
          }
        } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          if (this.status === 'connected') {
            this.status = 'failed';
            this.onVPNStatusChange?.();
          }
        }
      };

      this.webrtcManager.start();

      // Start stats polling
      this.statsTimer = setInterval(() => {
        this.onVPNStatsUpdate?.();
      }, 2000);
    } catch (err: any) {
      console.error('[desktop] VPN start failed', err);
      this.status = 'failed';
      this.onVPNStatusChange?.();
    }
  }

  async stopVPN(): Promise<void> {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = undefined;
    }
    this.status = 'idle';
    this.proxyClient?.stop();
    this.proxyClient = undefined;
    this.webrtcManager?.close();
    this.webrtcManager = undefined;
    // TUN mode disabled
    // await this.vpnEngine.stop();
    this.onVPNStatusChange?.();
  }

  private async discoverNASDevice(serverUrl: string, token: string): Promise<string | null> {
    try {
      const lastDeviceId = configStore.get('lastDeviceId');
      if (lastDeviceId) {
        return lastDeviceId;
      }

      const response = await axios.get(`${serverUrl}/api/clients`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-request-device-id': desktopDeviceId,
          'x-request-device-name': desktopDeviceName,
          'x-request-device-platform': desktopDevicePlatform,
        },
        timeout: 10000,
      });

      const data = response.data;
      if (!data.success || !Array.isArray(data.data?.clients)) {
        return null;
      }

      const clients: NASClient[] = data.data.clients;
      const onlineClient = clients.find((c) => c.status === 'online' && c.enabled !== false);
      return onlineClient?.clientId ?? null;
    } catch (err: any) {
      console.warn('[desktop] Failed to discover NAS device', err.message);
      return null;
    }
  }

  private handleVPNPacket(_packet: Buffer): void {
    // TUN mode disabled — use proxy mode instead
  }

  dispose(): void {
    this.stopVPN().catch(() => {});
  }
}
