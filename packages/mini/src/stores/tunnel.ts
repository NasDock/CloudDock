import type { Tunnel } from '@cloud-dock/shared';
import { tunnelApi, CreateTunnelRequest } from '../api/tunnel';

export interface TunnelState {
  tunnels: Tunnel[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

let _state: TunnelState = {
  tunnels: [],
  isLoading: false,
  error: null,
  pagination: { page: 1, limit: 20, total: 0 },
};

function setState(state: Partial<TunnelState>) {
  Object.assign(_state, state);
}

function getState(): TunnelState {
  return _state;
}

export const tunnelStore = {
  get tunnels() { return getState().tunnels; },
  get isLoading() { return getState().isLoading; },
  get error() { return getState().error; },
  get pagination() { return getState().pagination; },
  get onlineTunnels() { return getState().tunnels.filter((t) => t.status === 'online'); },
  get offlineTunnels() { return getState().tunnels.filter((t) => t.status === 'offline'); },

  async fetchTunnels(params?: { page?: number; limit?: number; status?: 'online' | 'offline' | 'all' }) {
    setState({ isLoading: true, error: null });
    try {
      const response = await tunnelApi.list(params);
      setState({ tunnels: response.tunnels, pagination: response.pagination, isLoading: false });
    } catch (err: any) {
      setState({ error: err?.message || '获取隧道列表失败', isLoading: false });
    }
  },

  async createTunnel(data: CreateTunnelRequest) {
    setState({ isLoading: true, error: null });
    try {
      const tunnel = await tunnelApi.create(data);
      setState((prev) => ({
        tunnels: [...prev.tunnels, tunnel],
        pagination: { ...prev.pagination, total: prev.pagination.total + 1 },
        isLoading: false,
      }));
      return tunnel;
    } catch (err: any) {
      setState({ error: err?.message || '创建隧道失败', isLoading: false });
      throw err;
    }
  },

  async deleteTunnel(tunnelId: string) {
    setState({ isLoading: true, error: null });
    try {
      await tunnelApi.delete(tunnelId);
      setState((prev) => ({
        tunnels: prev.tunnels.filter((t) => t.tunnelId !== tunnelId),
        pagination: { ...prev.pagination, total: prev.pagination.total - 1 },
        isLoading: false,
      }));
    } catch (err: any) {
      setState({ error: err?.message || '删除失败', isLoading: false });
      throw err;
    }
  },

  async setTunnelEnabled(tunnelId: string, enabled: boolean) {
    const result = await tunnelApi.setEnabled(tunnelId, enabled);
    setState((prev) => ({
      tunnels: prev.tunnels.map((t) =>
        t.tunnelId === tunnelId
          ? { ...t, enabled: result.enabled, status: result.status as any }
          : t
      ),
    }));
  },

  clearError() {
    setState({ error: null });
  },

  refresh(params?: { page?: number; limit?: number; status?: 'online' | 'offline' | 'all' }) {
    return this.fetchTunnels(params);
  },
};
