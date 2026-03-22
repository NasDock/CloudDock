import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';

interface StatusBadgeProps {
  status: 'online' | 'offline';
  label?: string;
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
}

export function StatusBadge({ status, label, size = 'medium', style }: StatusBadgeProps) {
  const dotColor = status === 'online' ? '#10B981' : '#6B7280';
  const bgColor = status === 'online' ? '#D1FAE5' : '#F3F4F6';
  const textColor = status === 'online' ? '#065F46' : '#4B5563';

  const dotSize = size === 'small' ? 6 : size === 'medium' ? 8 : 10;
  const fontSize = size === 'small' ? 10 : size === 'medium' ? 12 : 14;
  const paddingH = size === 'small' ? 6 : size === 'medium' ? 8 : 10;
  const paddingV = size === 'small' ? 2 : size === 'medium' ? 4 : 6;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bgColor, paddingHorizontal: paddingH, paddingVertical: paddingV },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor, width: dotSize, height: dotSize }]} />
      <Text style={[styles.label, { color: textColor, fontSize }]}>
        {label || (status === 'online' ? '在线' : '离线')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    gap: 4,
  },
  dot: {
    borderRadius: 9999,
  },
  label: {
    fontWeight: '500',
  },
});
