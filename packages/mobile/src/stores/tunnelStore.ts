import { create } from 'zustand';
import type { Tunnel } from '@cloud-dock/shared';
import { tunnelApi, CreateTunnelRequest, UpdateTunnelRequest } from '../api/tunnel';

interface TunnelState {
  tunnels: Tunnel[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };

  // Actions
  fetchTunnels: (params?: { page?: number; limit?: number; status?: 'online' | 'offline' | 'all' }) => Promise<void>;
  createTunnel: (data: CreateTunnelRequest) => Promise<Tunnel>;
  updateTunnel: (tunnelId: string, data: UpdateTunnelRequest) => Promise<Tunnel>;
  deleteTunnel: (tunnelId: string) => Promise<void>;
  regenerateToken: (tunnelId: string) => Promise<string>;
  setTunnelEnabled: (tunnelId: string, enabled: boolean) => Promise<void>;
  clearError: () => void;
  setTunnels: (tunnels: Tunnel[]) => void;
}

export const useTunnelStore = create<TunnelState>((set, get) => ({
  tunnels: [],
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
  },

  fetchTunnels: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await tunnelApi.list(params);
      set({
        tunnels: response.tunnels,
        pagination: response.pagination,
        isLoading: false,
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
      const message = err.response?.data?.error?.message || err.message || 'Failed to fetch tunnels';
      set({ error: message, isLoading: false });
    }
  },

  createTunnel: async (data: CreateTunnelRequest) => {
    set({ isLoading: true, error: null });
    try {
      const tunnel = await tunnelApi.create(data);
      set((state) => ({
        tunnels: [...state.tunnels, tunnel],
        pagination: { ...state.pagination, total: state.pagination.total + 1 },
        isLoading: false,
      }));
      return tunnel;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
      const message = err.response?.data?.error?.message || err.message || 'Failed to create tunnel';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  updateTunnel: async (tunnelId: string, data: UpdateTunnelRequest) => {
    set({ isLoading: true, error: null });
    try {
      const tunnel = await tunnelApi.update(tunnelId, data);
      set((state) => ({
        tunnels: state.tunnels.map((t) => (t.tunnelId === tunnelId ? tunnel : t)),
        isLoading: false,
      }));
      return tunnel;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
      const message = err.response?.data?.error?.message || err.message || 'Failed to update tunnel';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  deleteTunnel: async (tunnelId: string) => {
    set({ isLoading: true, error: null });
    try {
      await tunnelApi.delete(tunnelId);
      set((state) => ({
        tunnels: state.tunnels.filter((t) => t.tunnelId !== tunnelId),
        pagination: { ...state.pagination, total: state.pagination.total - 1 },
        isLoading: false,
      }));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
      const message = err.response?.data?.error?.message || err.message || 'Failed to delete tunnel';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  regenerateToken: async (tunnelId: string) => {
    const response = await tunnelApi.regenerateToken(tunnelId);
    set((state) => ({
      tunnels: state.tunnels.map((t) =>
        t.tunnelId === tunnelId ? { ...t, accessToken: response.accessToken } : t
      ),
    }));
    return response.accessToken;
  },

  setTunnelEnabled: async (tunnelId: string, enabled: boolean) => {
    const result = await tunnelApi.setEnabled(tunnelId, enabled);
    set((state) => ({
      tunnels: state.tunnels.map((t) =>
        t.tunnelId === tunnelId ? { ...t, enabled: result.enabled, status: result.status as any } : t
      ),
    }));
  },

  clearError: () => {
    set({ error: null });
  },

  setTunnels: (tunnels: Tunnel[]) => {
    set({ tunnels });
  },
}));
