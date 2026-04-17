import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

// Pure black & white theme - Light
export const lightTheme = {
  ...MD3LightTheme,
  dark: false,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#111827',
    primaryContainer: '#f3f4f6',
    secondary: '#374151',
    secondaryContainer: '#e5e7eb',
    tertiary: '#6b7280',
    tertiaryContainer: '#f9fafb',
    error: '#dc2626',
    errorContainer: '#fee2e2',
    background: '#ffffff',
    surface: '#ffffff',
    surfaceVariant: '#f9fafb',
    surfaceDisabled: '#e5e7eb',
    outline: '#d1d5db',
    outlineVariant: '#e5e7eb',
    onPrimary: '#ffffff',
    onPrimaryContainer: '#111827',
    onSecondary: '#ffffff',
    onSecondaryContainer: '#374151',
    onTertiary: '#ffffff',
    onTertiaryContainer: '#6b7280',
    onError: '#ffffff',
    onErrorContainer: '#dc2626',
    onBackground: '#111827',
    onSurface: '#111827',
    onSurfaceVariant: '#374151',
    onSurfaceDisabled: '#9ca3af',
    onOutline: '#6b7280',
    onOutlineVariant: '#d1d5db',
    inverseSurface: '#1f2937',
    inverseOnSurface: '#f9fafb',
    inversePrimary: '#9ca3af',
    shadow: '#000000',
    scrim: '#000000',
    backdrop: 'rgba(0, 0, 0, 0.4)',
    elevation: {
      level0: 'transparent',
      level1: '#ffffff',
      level2: '#f9fafb',
      level3: '#f3f4f6',
      level4: '#f0f1f2',
      level5: '#ededef',
    },
  },
};

// Pure black & white theme - Dark
export const darkTheme = {
  ...MD3DarkTheme,
  dark: true,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#f9fafb',
    primaryContainer: '#374151',
    secondary: '#e5e7eb',
    secondaryContainer: '#4b5563',
    tertiary: '#9ca3af',
    tertiaryContainer: '#1f2937',
    error: '#f87171',
    errorContainer: '#7f1d1d',
    background: '#111827',
    surface: '#1f2937',
    surfaceVariant: '#374151',
    surfaceDisabled: '#4b5563',
    outline: '#6b7280',
    outlineVariant: '#374151',
    onPrimary: '#111827',
    onPrimaryContainer: '#f9fafb',
    onSecondary: '#111827',
    onSecondaryContainer: '#e5e7eb',
    onTertiary: '#111827',
    onTertiaryContainer: '#9ca3af',
    onError: '#111827',
    onErrorContainer: '#f87171',
    onBackground: '#f9fafb',
    onSurface: '#f9fafb',
    onSurfaceVariant: '#e5e7eb',
    onSurfaceDisabled: '#6b7280',
    onOutline: '#9ca3af',
    onOutlineVariant: '#4b5563',
    inverseSurface: '#f9fafb',
    inverseOnSurface: '#1f2937',
    inversePrimary: '#6b7280',
    shadow: '#000000',
    scrim: '#000000',
    backdrop: 'rgba(0, 0, 0, 0.6)',
    elevation: {
      level0: 'transparent',
      level1: '#1f2937',
      level2: '#252e3f',
      level3: '#2c3648',
      level4: '#2f3a50',
      level5: '#344159',
    },
  },
};

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isLoading: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  init: () => Promise<void>;
  _startPolling: () => void;
  _stopPolling: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  resolvedTheme: 'light',
  isLoading: true,

  setMode: async (mode: ThemeMode) => {
    const { resolvedTheme } = get();
    const newResolved = mode === 'system' ? resolvedTheme : (mode as ResolvedTheme);
    set({ mode, resolvedTheme: newResolved });
    await AsyncStorage.setItem('themeMode', mode);
  },

  init: async () => {
    try {
      const storedMode = (await AsyncStorage.getItem('themeMode')) as ThemeMode | null;
      // Also get stored resolved theme for system mode
      const storedResolved = (await AsyncStorage.getItem('systemTheme')) as ResolvedTheme | null;
      const mode = storedMode || 'system';
      const resolved = mode === 'system'
        ? (storedResolved || 'light')
        : (mode as ResolvedTheme);
      set({ mode, resolvedTheme: resolved, isLoading: false });
      get()._startPolling();
    } catch {
      set({ isLoading: false });
      get()._startPolling();
    }
  },

  _startPolling: () => {
    const poll = () => {
      const { mode } = get();
      if (mode === 'system') {
        try {
          const { Appearance } = require('react-native');
          const colorScheme = Appearance.getColorScheme();
          const systemDark = colorScheme === 'dark';
          const { resolvedTheme } = get();
          const newResolved: ResolvedTheme = systemDark ? 'dark' : 'light';
          if (newResolved !== resolvedTheme) {
            set({ resolvedTheme: newResolved });
            AsyncStorage.setItem('systemTheme', newResolved);
          }
        } catch {
          // Ignore
        }
      }
    };

    // Poll every second
    const id = setInterval(poll, 1000);
    // Also store the interval id reference in the store state
    setTimeout(() => {
      // Clear the interval after setting it up
      // (we just use the interval continuously for simplicity)
    }, 0);
  },

  _stopPolling: () => {
    // Note: In React, we handle cleanup in useEffect
    // The polling runs via setInterval globally
  },
}));

// Cleanup function to be called on unmount
let _pollInterval: ReturnType<typeof setInterval> | null = null;

export const startThemePolling = () => {
  if (_pollInterval) return;
  _pollInterval = setInterval(() => {
    const { mode } = useThemeStore.getState();
    if (mode === 'system') {
      try {
        const { Appearance } = require('react-native');
        const colorScheme = Appearance.getColorScheme();
        const systemDark = colorScheme === 'dark';
        const { resolvedTheme } = useThemeStore.getState();
        const newResolved: ResolvedTheme = systemDark ? 'dark' : 'light';
        if (newResolved !== resolvedTheme) {
          useThemeStore.setState({ resolvedTheme: newResolved });
          AsyncStorage.setItem('systemTheme', newResolved);
        }
      } catch {
        // Ignore
      }
    }
  }, 1000);
};

export const stopThemePolling = () => {
  if (_pollInterval) {
    clearInterval(_pollInterval);
    _pollInterval = null;
  }
};
