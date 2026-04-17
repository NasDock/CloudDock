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
  _startListening: () => void;
  _stopListening: () => void;
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
      const storedResolved = (await AsyncStorage.getItem('systemTheme')) as ResolvedTheme | null;
      const mode = storedMode || 'system';
      const resolved = mode === 'system'
        ? (storedResolved || 'light')
        : (mode as ResolvedTheme);
      set({ mode, resolvedTheme: resolved, isLoading: false });
      get()._startListening();
    } catch {
      set({ isLoading: false });
      get()._startListening();
    }
  },

  _startListening: () => {
    const { Appearance } = require('react-native');
    const subscription = Appearance.addEventListener('change', ({ type }) => {
      const { mode } = get();
      if (mode === 'system') {
        const newResolved: ResolvedTheme = type === 'dark' ? 'dark' : 'light';
        set({ resolvedTheme: newResolved });
        AsyncStorage.setItem('systemTheme', newResolved);
      }
    });
    // Store subscription for cleanup if needed
    (get as any)._appearanceSubscription = subscription;
  },

  _stopListening: () => {
    const subscription = (get as any)._appearanceSubscription;
    if (subscription?.remove) {
      subscription.remove();
    }
  },
}));
