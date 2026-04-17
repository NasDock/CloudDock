import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

export const useTheme = () => {
  const { mode, resolvedTheme, setMode, pollSystemTheme } = useThemeStore();

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

    // Set up polling to detect system theme changes
    const intervalId = setInterval(pollSystemTheme, 1000);

    // Also listen for system theme change events
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (mode === 'system') {
        pollSystemTheme();
      }
    };
    mediaQuery?.addEventListener('change', handleChange);

    return () => {
      clearInterval(intervalId);
      mediaQuery?.removeEventListener('change', handleChange);
    };
  }, [mode, pollSystemTheme]);

  return { mode, resolvedTheme, setMode };
};
