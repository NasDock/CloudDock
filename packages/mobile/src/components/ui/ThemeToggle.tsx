import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { useThemeStore, type ThemeMode } from '@/stores/themeStore';

const SunIcon = () => (
  <Text style={styles.iconText}>☀️</Text>
);

const MoonIcon = () => (
  <Text style={styles.iconText}>🌙</Text>
);

const MonitorIcon = () => (
  <Text style={styles.iconText}>💻</Text>
);

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
];

export const ThemeToggle = () => {
  const theme = useTheme();
  const { mode, setMode } = useThemeStore();

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={mode}
        onValueChange={(val) => setMode(val as ThemeMode)}
        buttons={OPTIONS.map((opt) => ({
          value: opt.value,
          label: opt.label,
          style: [
            mode === opt.value && {
              backgroundColor: theme.colors.primaryContainer,
            },
          ],
        }))}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  iconText: {
    fontSize: 14,
  },
});
