import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { Text, IconButton, Button } from 'react-native-paper';
import type { Tunnel } from '@cloud-dock/shared';

interface TunnelCardProps {
  tunnel: Tunnel;
  publicUrl: string;
  deviceName?: string;
  onPress?: () => void;
  onDelete?: () => void;
  onToggle?: () => void;
  onCopy?: () => void;
  style?: ViewStyle;
}

export function TunnelCard({ tunnel, publicUrl, deviceName, onPress, onDelete, onToggle, onCopy, style }: TunnelCardProps) {
  return (
    <Card
      title={tunnel.name}
      subtitle={`${tunnel.protocol.toUpperCase()} • ${tunnel.localAddress}`}
      status={(tunnel as any).enabled === false ? 'offline' : tunnel.status}
      statusLabel={(tunnel as any).enabled === false ? '已下线' : tunnel.status === 'online' ? '在线' : '离线'}
      onPress={onPress}
      style={style}
      right={
        <IconButton icon="delete-outline" size={20} onPress={onDelete} iconColor="#6B7280" />
      }
    >
      <View style={styles.footer}>
        <View style={styles.info}>
          <Text style={styles.label}>访问路径</Text>
          <View style={styles.valueRow}>
            <Text style={styles.value} numberOfLines={1}>{publicUrl}</Text>
            <IconButton icon="content-copy" size={16} onPress={onCopy} />
          </View>
        </View>
        {deviceName && (
          <View style={styles.info}>
            <Text style={styles.label}>设备</Text>
            <Text style={styles.value}>{deviceName}</Text>
          </View>
        )}
        <View style={styles.actions}>
          <Button mode="outlined" compact onPress={onToggle}>
            {(tunnel as any).enabled === false ? '上线' : '下线'}
          </Button>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: 8,
    gap: 10,
  },
  info: {
    gap: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
  },
  value: {
    fontSize: 12,
    color: '#374151',
    flex: 1,
  },
  actions: {
    marginTop: 4,
    alignItems: 'flex-end',
  },
});
