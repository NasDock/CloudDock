import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTunnelStore } from '@/stores/tunnelStore';
import {
  getTunnels,
  getTunnel,
  createTunnel,
  updateTunnel,
  deleteTunnel,
  regenerateTunnelToken,
  setTunnelEnabled,
  getTunnelLogs,
  type CreateTunnelRequest,
  type UpdateTunnelRequest,
} from '@/api/tunnel';
import type { Tunnel } from '@cloud-dock/shared';

export type TunnelStatusFilter = 'all' | 'online' | 'offline';

export const useTunnels = (params?: { page?: number; limit?: number; status?: TunnelStatusFilter }) => {
  const { setTunnels } = useTunnelStore();

  const query = useQuery({
    queryKey: ['tunnels', params],
    queryFn: async () => {
      const { data } = await getTunnels(params);
      if (data.success && data.data) {
        setTunnels(data.data.tunnels as Tunnel[]);
        return data.data;
      }
      throw new Error('Failed to fetch tunnels');
    },
  });

  return query;
};

export const useTunnel = (tunnelId: string) => {
  const { setSelectedTunnel } = useTunnelStore();

  const query = useQuery({
    queryKey: ['tunnel', tunnelId],
    queryFn: async () => {
      const { data } = await getTunnel(tunnelId);
      if (data.success && data.data) {
        setSelectedTunnel(data.data as Tunnel);
        return data.data;
      }
      throw new Error('Failed to fetch tunnel');
    },
    enabled: !!tunnelId,
  });

  return query;
};

export const useCreateTunnel = () => {
  const queryClient = useQueryClient();
  const { addTunnel } = useTunnelStore();

  return useMutation({
    mutationFn: (data: CreateTunnelRequest) => createTunnel(data),
    onSuccess: (res) => {
      if (res.data.success && res.data.data) {
        addTunnel(res.data.data as Tunnel);
        queryClient.invalidateQueries({ queryKey: ['tunnels'] });
      }
    },
  });
};

export const useUpdateTunnel = () => {
  const queryClient = useQueryClient();
  const { updateTunnel: updateTunnelStore } = useTunnelStore();

  return useMutation({
    mutationFn: ({ tunnelId, data }: { tunnelId: string; data: UpdateTunnelRequest }) =>
      updateTunnel(tunnelId, data),
    onSuccess: (res, { tunnelId }) => {
      if (res.data.success && res.data.data) {
        updateTunnelStore(tunnelId, res.data.data as Partial<Tunnel>);
        queryClient.invalidateQueries({ queryKey: ['tunnels'] });
        queryClient.invalidateQueries({ queryKey: ['tunnel', tunnelId] });
      }
    },
  });
};

export const useDeleteTunnel = () => {
  const queryClient = useQueryClient();
  const { removeTunnel } = useTunnelStore();

  return useMutation({
    mutationFn: (tunnelId: string) => deleteTunnel(tunnelId),
    onSuccess: (_, tunnelId) => {
      removeTunnel(tunnelId);
      queryClient.invalidateQueries({ queryKey: ['tunnels'] });
    },
  });
};

export const useRegenerateTunnelToken = () => {
  const queryClient = useQueryClient();
  const { updateTunnel } = useTunnelStore();

  return useMutation({
    mutationFn: (tunnelId: string) => regenerateTunnelToken(tunnelId),
    onSuccess: (res, tunnelId) => {
      if (res.data.success && res.data.data) {
        updateTunnel(tunnelId, { accessToken: res.data.data.accessToken } as Partial<Tunnel>);
        queryClient.invalidateQueries({ queryKey: ['tunnel', tunnelId] });
      }
    },
  });
};

export const useSetTunnelEnabled = () => {
  const queryClient = useQueryClient();
  const { updateTunnel } = useTunnelStore();

  return useMutation({
    mutationFn: ({ tunnelId, enabled }: { tunnelId: string; enabled: boolean }) =>
      setTunnelEnabled(tunnelId, enabled),
    onSuccess: (res, { tunnelId }) => {
      if (res.data.success && res.data.data) {
        updateTunnel(tunnelId, {
          enabled: res.data.data.enabled,
          status: res.data.data.status,
        } as Partial<Tunnel>);
        queryClient.invalidateQueries({ queryKey: ['tunnels'] });
        queryClient.invalidateQueries({ queryKey: ['tunnel', tunnelId] });
      }
    },
  });
};

export const useTunnelLogs = (
  tunnelId: string,
  params?: { startTime?: string; endTime?: string; page?: number; limit?: number },
) => {
  return useQuery({
    queryKey: ['tunnel-logs', tunnelId, params],
    queryFn: async () => {
      const { data } = await getTunnelLogs(tunnelId, params);
      if (data.success && data.data) {
        return data.data;
      }
      throw new Error('Failed to fetch logs');
    },
    enabled: !!tunnelId,
  });
};
