import { create } from 'zustand';

export interface TunnelStatus {
  id: string;
  name: string;
  protocol: 'http' | 'tcp' | 'udp';
  localAddress: string;
  publicPath?: string;
  status: 'online' | 'offline' | 'connecting' | 'error';
  error?: string;
}

export interface HealthStatus {
  healthy: boolean;
  latencyMs?: number;
  lastCheck?: number;
}

interface AppState {
  // Connection
  connected: boolean;
  reconnecting: boolean;
  reconnectAttempts: number;
  lastError?: string;

  // Health
  health: HealthStatus;

  // Tunnels
  tunnels: TunnelStatus[];
  selectedTunnelId?: string;

  // UI
  currentPage: 'dashboard' | 'tunnels' | 'settings' | 'login';
  isConfiguring: boolean;

  // Server config
  serverUrl: string;
  deviceToken: string;
  deviceName: string;

  // Actions
  setConnected: (connected: boolean) => void;
  setReconnecting: (reconnecting: boolean, attempts?: number) => void;
  setLastError: (error?: string) => void;
  setHealth: (health: HealthStatus) => void;
  setTunnels: (tunnels: TunnelStatus[]) => void;
  updateTunnel: (id: string, updates: Partial<TunnelStatus>) => void;
  selectTunnel: (id?: string) => void;
  setCurrentPage: (page: AppState['currentPage']) => void;
  setConfiguring: (isConfiguring: boolean) => void;
  setServerUrl: (url: string) => void;
  setDeviceToken: (token: string) => void;
  setDeviceName: (name: string) => void;
}

export const useStore = create<AppState>((set) => ({
  // Initial state
  connected: false,
  reconnecting: false,
  reconnectAttempts: 0,
  health: { healthy: false },
  tunnels: [],
  currentPage: 'dashboard',
  isConfiguring: false,
  serverUrl: '',
  deviceToken: '',
  deviceName: 'My NAS',

  // Actions
  setConnected: (connected) => set({ connected, lastError: connected ? undefined : undefined }),

  setReconnecting: (reconnecting, attempts = 0) => set({
    reconnecting,
    reconnectAttempts: attempts
  }),

  setLastError: (lastError) => set({ lastError }),

  setHealth: (health) => set({ health }),

  setTunnels: (tunnels) => set({ tunnels }),

  updateTunnel: (id, updates) => set((state) => ({
    tunnels: state.tunnels.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    )
  })),

  selectTunnel: (selectedTunnelId) => set({ selectedTunnelId }),

  setCurrentPage: (currentPage) => set({ currentPage }),

  setConfiguring: (isConfiguring) => set({ isConfiguring }),

  setServerUrl: (serverUrl) => set({ serverUrl }),

  setDeviceToken: (deviceToken) => set({ deviceToken }),

  setDeviceName: (deviceName) => set({ deviceName }),
}));
