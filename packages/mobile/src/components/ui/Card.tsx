import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Card as PaperCard, Text } from 'react-native-paper';
import { StatusBadge } from './StatusBadge';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  status?: 'online' | 'offline';
  statusLabel?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Card({ children, title, subtitle, status, statusLabel, right, onPress, style }: CardProps) {
  return (
    <PaperCard style={[styles.card, style]} onPress={onPress} mode="elevated">
      <PaperCard.Content style={styles.content}>
        {(title || subtitle || status || right) && (
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {title && <Text style={styles.title}>{title}</Text>}
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            <View style={styles.headerRight}>
              {status && <StatusBadge status={status} label={statusLabel} />}
              {right}
            </View>
          </View>
        )}
        {children}
      </PaperCard.Content>
    </PaperCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  content: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
});
