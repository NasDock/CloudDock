import React from 'react';
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Button as PaperButton, ActivityIndicator } from 'react-native-paper';

interface ButtonProps {
  children: string;
  onPress: () => void;
  mode?: 'text' | 'outlined' | 'contained' | 'elevated' | 'contained-tonal';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function Button({
  children,
  onPress,
  mode = 'contained',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  variant = 'primary',
}: ButtonProps) {
  const isFilled = mode === 'contained' || mode === 'contained-tonal' || mode === 'elevated';
  const buttonColor = isFilled
    ? variant === 'primary'
      ? '#6366F1'
      : variant === 'danger'
        ? '#EF4444'
        : undefined
    : undefined;

  return (
    <PaperButton
      mode={mode}
      onPress={onPress}
      loading={loading}
      disabled={disabled || loading}
      icon={icon}
      style={[styles.button, style]}
      contentStyle={styles.content}
      labelStyle={[styles.label, textStyle]}
      buttonColor={buttonColor}
    >
      {children}
    </PaperButton>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    marginVertical: 4,
  },
  content: {
    paddingVertical: 6,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});
