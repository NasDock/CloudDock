import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Appbar } from 'react-native-paper';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  style?: ViewStyle;
  compact?: boolean;
}

export function Header({ title, subtitle, showBack, onBack, right, style, compact }: HeaderProps) {
  return (
    <Appbar.Header statusBarHeight={compact ? 0 : undefined} style={[styles.header, style]}>
      {showBack && <Appbar.BackAction onPress={onBack} />}
      <Appbar.Content
        title={title}
        subtitle={subtitle}
        titleStyle={styles.title}
        subtitleStyle={styles.subtitle}
      />
      {right}
    </Appbar.Header>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#FFFFFF',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
});
