import { create } from 'zustand';
import type { Tunnel } from '@cloud-dock/shared';

interface TunnelState {
  tunnels: Tunnel[];
  selectedTunnel: Tunnel | null;
  wsConnected: boolean;
  setTunnels: (tunnels: Tunnel[]) => void;
  addTunnel: (tunnel: Tunnel) => void;
  updateTunnel: (tunnelId: string, updates: Partial<Tunnel>) => void;
  removeTunnel: (tunnelId: string) => void;
  setSelectedTunnel: (tunnel: Tunnel | null) => void;
  setWsConnected: (connected: boolean) => void;
}

export const useTunnelStore = create<TunnelState>((set) => ({
  tunnels: [],
  selectedTunnel: null,
  wsConnected: false,

  setTunnels: (tunnels) => set({ tunnels }),

  addTunnel: (tunnel) =>
    set((state) => ({
      tunnels: [...state.tunnels, tunnel],
    })),

  updateTunnel: (tunnelId, updates) =>
    set((state) => ({
      tunnels: state.tunnels.map((t) =>
        t.tunnelId === tunnelId ? { ...t, ...updates } : t,
      ),
      selectedTunnel:
        state.selectedTunnel?.tunnelId === tunnelId
          ? { ...state.selectedTunnel, ...updates }
          : state.selectedTunnel,
    })),

  removeTunnel: (tunnelId) =>
    set((state) => ({
      tunnels: state.tunnels.filter((t) => t.tunnelId !== tunnelId),
      selectedTunnel:
        state.selectedTunnel?.tunnelId === tunnelId ? null : state.selectedTunnel,
    })),

  setSelectedTunnel: (selectedTunnel) => set({ selectedTunnel }),

  setWsConnected: (wsConnected) => set({ wsConnected }),
}));
