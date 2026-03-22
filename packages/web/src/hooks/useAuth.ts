import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  authLogin,
  authRegister,
  authLogout,
  getUserInfo,
  type LoginInput,
  type RegisterInput,
} from '@/api/auth';
import { clearTokens, isAuthenticated } from '@/api/client';
import { clientApi } from '@/api/client';
import { nasClientApi } from '@/api/nasClient';

export const useAuth = () => {
  const { user, isAuthenticated: storeAuth, setUser, setLoading, logout: storeLogout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const serverWsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3300/ws/device';

  const setupNasClient = async () => {
    try {
      const defaultClient = await clientApi.getDefault();
      await nasClientApi.configure({
        serverUrl: serverWsUrl,
        clientKey: defaultClient.clientKey,
        deviceName: defaultClient.name,
      });
      await nasClientApi.connect();
    } catch {
      // Non-blocking: local NAS client may be offline
    }
  };

  // Sync auth state on mount
  useEffect(() => {
    const syncAuth = async () => {
      if (isAuthenticated()) {
        try {
          const userData = await getUserInfo();
          if (userData) {
            setUser(userData as any);
            setupNasClient();
          } else {
            clearTokens();
            setUser(null);
          }
        } catch {
          clearTokens();
          setUser(null);
        }
      } else {
        setUser(null);
      }
    };
    syncAuth();
  }, []);

  const loginMutation = useMutation({
    mutationFn: (data: LoginInput) => authLogin(data),
    onSuccess: async () => {
      // Tokens are set in authLogin, now fetch user info
      try {
        const userData = await getUserInfo();
        if (userData) {
          setUser(userData as any);
        }
        setupNasClient();
        navigate('/dashboard');
      } catch {
        navigate('/dashboard');
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: RegisterInput) => authRegister(data),
    onSuccess: () => {
      navigate('/login');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => authLogout(),
    onSuccess: () => {
      storeLogout();
      queryClient.clear();
      clearTokens();
      navigate('/login');
    },
    onError: () => {
      storeLogout();
      queryClient.clear();
      clearTokens();
      navigate('/login');
    },
  });

  return {
    user,
    isAuthenticated: storeAuth,
    isLoading: useAuthStore.getState().isLoading,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
  };
};
