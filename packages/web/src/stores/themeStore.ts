import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  pollSystemTheme: () => void;
}

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const resolveTheme = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode === 'system') return getSystemTheme();
  return mode;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      resolvedTheme: getSystemTheme(),

      setMode: (mode) => {
        set({ mode, resolvedTheme: resolveTheme(mode) });
        // Update DOM class for Tailwind dark mode
        if (typeof document !== 'undefined') {
          const resolved = resolveTheme(mode);
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add(resolved);
          document.documentElement.setAttribute('data-theme', resolved);
        }
      },

      pollSystemTheme: () => {
        const { mode } = get();
        if (mode === 'system') {
          const newResolved = getSystemTheme();
          const { resolvedTheme } = get();
          if (newResolved !== resolvedTheme) {
            set({ resolvedTheme: newResolved });
            if (typeof document !== 'undefined') {
              document.documentElement.classList.remove('light', 'dark');
              document.documentElement.classList.add(newResolved);
              document.documentElement.setAttribute('data-theme', newResolved);
            }
          }
        }
      },
    }),
    {
      name: 'theme-storage',
    },
  ),
);
