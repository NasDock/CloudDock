import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

export const useTheme = () => {
  const { mode, resolvedTheme, setMode } = useThemeStore();

  // Initialize theme on mount (apply correct class to <html>)
  useEffect(() => {
    const applyTheme = () => {
      const resolved = mode === 'system'
        ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : mode;
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    };

    applyTheme();

    // Listen for system theme change events
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const { mode } = useThemeStore.getState();
      if (mode === 'system') {
        const resolved = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(resolved);
        document.documentElement.setAttribute('data-theme', resolved);
        useThemeStore.setState({ resolvedTheme: resolved });
      }
    };
    mediaQuery?.addEventListener('change', handleChange);

    return () => {
      mediaQuery?.removeEventListener('change', handleChange);
    };
  }, [mode]);

  return { mode, resolvedTheme, setMode };
};
