import React, { useState } from 'react';
import { StyleSheet, Alert } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/layout/Header';
import { TunnelForm } from '../components/tunnel/TunnelForm';
import { LoadingOverlay } from '../components/ui/LoadingOverlay';
import { useTunnel } from '../hooks/useTunnel';
import type { Protocol } from '@cloud-dock/shared';

export default function TunnelCreateScreen() {
  const router = useRouter();
  const { createTunnel, isLoading, error, clearError } = useTunnel();

  const handleSubmit = async (data: {
    name: string;
    protocol: Protocol;
    localAddress: string;
    localHostname?: string;
  }) => {
    try {
      const tunnel = await createTunnel({
        name: data.name,
        protocol: data.protocol,
        localAddress: data.localAddress,
        localHostname: data.localHostname,
      });
      Alert.alert('成功', '隧道创建成功', [
        {
          text: '查看详情',
          onPress: () =>
            router.replace({ pathname: '/tunnel-detail', params: { tunnelId: tunnel.tunnelId } }),
        },
        {
          text: '返回列表',
          onPress: () => router.back(),
        },
      ]);
    } catch {
      // Error handled by store
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="创建隧道" showBack onBack={() => router.back()} />

      <TunnelForm onSubmit={handleSubmit} isLoading={isLoading} />

      <LoadingOverlay visible={isLoading} message="创建中..." />

      <Snackbar
        visible={!!error}
        onDismiss={clearError}
        duration={3000}
        style={styles.snackbar}
      >
        {error}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  snackbar: {
    backgroundColor: '#EF4444',
  },
});
