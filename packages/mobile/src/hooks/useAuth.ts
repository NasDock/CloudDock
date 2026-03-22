import { useCallback, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import type { UserPublic } from '@cloud-dock/shared';

export function useAuth() {
  const { user, isAuthenticated, isLoading, error, login, register, logout, checkAuth, updateUser, clearError } =
    useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const isLoggedIn = isAuthenticated;

  const auth: {
    user: UserPublic | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    isLoggedIn: boolean;
  } = {
    user,
    isAuthenticated,
    isLoading,
    error,
    isLoggedIn,
  };

  return {
    auth,
    login: useCallback(login, [login]),
    register: useCallback(register, [register]),
    logout: useCallback(logout, [logout]),
    checkAuth: useCallback(checkAuth, [checkAuth]),
    updateUser: useCallback(updateUser, [updateUser]),
    clearError: useCallback(clearError, [clearError]),
  };
}
