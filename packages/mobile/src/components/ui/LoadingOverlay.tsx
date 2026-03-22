import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  style?: ViewStyle;
}

export function LoadingOverlay({ visible, message, style }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <View style={[styles.overlay, style]}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#6366F1" />
        {message && <Text style={styles.message}>{message}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  content: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
    minWidth: 120,
  },
  message: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
});
