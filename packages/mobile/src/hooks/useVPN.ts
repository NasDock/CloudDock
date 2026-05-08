import { useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useVPNStore } from '../stores/vpn-store';
import { startWebRTC, stopWebRTC } from '../webrtc';
import api from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deviceApi } from '../api/device';

let globalWebRTCStarted = false;

async function ensureWebRTCStarted(): Promise<boolean> {
  if (globalWebRTCStarted) return true;

  try {
    const token = await AsyncStorage.getItem('accessToken');
    if (!token) return false;

    // Get first online NAS client
    const { clients } = await deviceApi.list();
    const onlineClient = clients.find((c) => c.status === 'online' && c.enabled !== false);
    if (!onlineClient) return false;

    const serverUrl = api.defaults.baseURL?.replace('/api', '') || 'https://cloud.audiodock.cn';

    startWebRTC({ serverUrl, deviceId: onlineClient.clientId, token });
    globalWebRTCStarted = true;
    return true;
  } catch (err) {
    console.warn('[useVPN] failed to start WebRTC', err);
    return false;
  }
}

export function useVPN() {
  const { isAuthenticated } = useAuthStore();
  const { status, virtualIp, nasVirtualIp, stats, error, startVPN, stopVPN, toggleVPN, resetError } = useVPNStore();
  const initAttempted = useRef(false);

  // Attempt to start WebRTC on auth (best effort)
  useEffect(() => {
    if (!isAuthenticated || initAttempted.current) return;
    initAttempted.current = true;
    ensureWebRTCStarted().catch(() => {});

    return () => {
      globalWebRTCStarted = false;
      stopWebRTC();
    };
  }, [isAuthenticated]);

  const wrappedStartVPN = useCallback(async () => {
    await ensureWebRTCStarted();
    return startVPN();
  }, [startVPN]);

  const wrappedToggleVPN = useCallback(async () => {
    if (status === 'connected' || status === 'connecting') {
      return stopVPN();
    }
    await ensureWebRTCStarted();
    return startVPN();
  }, [status, startVPN, stopVPN]);

  return {
    status,
    virtualIp,
    nasVirtualIp,
    stats,
    error,
    startVPN: wrappedStartVPN,
    stopVPN: useCallback(stopVPN, [stopVPN]),
    toggleVPN: wrappedToggleVPN,
    resetError: useCallback(resetError, [resetError]),
    isConnected: status === 'connected',
  };
}
