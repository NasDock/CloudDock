import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Navigation from './navigation';
import { useAuth } from './hooks/useAuth';
import {
  useThemeStore,
  lightTheme,
  darkTheme,
  startThemePolling,
  stopThemePolling,
} from './stores/themeStore';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

function AppContent() {
  const { checkAuth } = useAuth();
  const { resolvedTheme } = useThemeStore();

  useEffect(() => {
    checkAuth();
    return () => stopThemePolling();
  }, [checkAuth]);

  const statusBarStyle = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Navigation />
    </>
  );
}

function ThemedApp() {
  const { resolvedTheme, isLoading, init } = useThemeStore();

  useEffect(() => {
    init();
    startThemePolling();
  }, []);

  if (isLoading) {
    return null; // Or a splash screen
  }

  const theme = resolvedTheme === 'dark' ? darkTheme : lightTheme;

  return (
    <PaperProvider theme={theme}>
      <AppContent />
    </PaperProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemedApp />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
