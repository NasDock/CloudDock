import { useCallback, useEffect } from 'react';
import { useTunnelStore } from '../stores/tunnelStore';
import type { Tunnel } from '@cloud-dock/shared';
import { tunnelApi, CreateTunnelRequest, UpdateTunnelRequest } from '../api/tunnel';

export function useTunnel() {
  const { tunnels, isLoading, error, pagination, fetchTunnels, createTunnel, updateTunnel, deleteTunnel, regenerateToken, setTunnelEnabled, clearError, setTunnels } =
    useTunnelStore();

  const refresh = useCallback(
    (params?: { page?: number; limit?: number; status?: 'online' | 'offline' | 'all' }) => {
      return fetchTunnels(params);
    },
    [fetchTunnels]
  );

  // Auto-fetch tunnels on mount
  useEffect(() => {
    fetchTunnels();
  }, [fetchTunnels]);

  const onlineTunnels = tunnels.filter((t) => t.status === 'online');
  const offlineTunnels = tunnels.filter((t) => t.status === 'offline');

  return {
    tunnels,
    onlineTunnels,
    offlineTunnels,
    isLoading,
    error,
    pagination,
    refresh,
    createTunnel: useCallback(createTunnel, [createTunnel]),
    updateTunnel: useCallback(updateTunnel, [updateTunnel]),
    deleteTunnel: useCallback(deleteTunnel, [deleteTunnel]),
    regenerateToken: useCallback(regenerateToken, [regenerateToken]),
    setTunnelEnabled: useCallback(setTunnelEnabled, [setTunnelEnabled]),
    clearError: useCallback(clearError, [clearError]),
    setTunnels: useCallback(setTunnels, [setTunnels]),
    getPublicUrl: tunnelApi.getPublicUrl,
  };
}
