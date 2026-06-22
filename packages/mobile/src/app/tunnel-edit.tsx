import React, { useState } from 'react';
import { StyleSheet, Alert } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/layout/Header';
import { TunnelForm } from '../components/tunnel/TunnelForm';
import { LoadingOverlay } from '../components/ui/LoadingOverlay';
import { useTunnel } from '../hooks/useTunnel';
import { tunnelApi } from '../api/tunnel';
import type { TunnelFormData } from '../components/tunnel/TunnelForm';
import type { Protocol } from '@cloud-dock/shared';

export default function TunnelEditScreen() {
  const { tunnelId } = useLocalSearchParams<{ tunnelId: string }>();
  const router = useRouter();
  const { updateTunnel, isLoading, error, clearError } = useTunnel();

  const [initialData, setInitialData] = useState<{
    name: string;
    protocol: Protocol;
    localAddress: string;
    localHostname?: string | undefined;
  } | null>(null);
  const [isFetching, setIsFetching] = useState(true);

  React.useEffect(() => {
    let cancelled = false;
    const fetchTunnel = async () => {
      try {
        const data = await tunnelApi.get(tunnelId);
        if (!cancelled) {
          setInitialData({
            name: data.name,
            protocol: data.protocol,
            localAddress: data.localAddress,
            localHostname: data.localHostname || undefined,
          });
        }
      } catch {
        if (!cancelled) {
          Alert.alert('错误', '获取隧道信息失败');
        }
      } finally {
        if (!cancelled) {
          setIsFetching(false);
        }
      }
    };
    fetchTunnel();
    return () => {
      cancelled = true;
    };
  }, [tunnelId]);

  const handleSubmit = async (data: TunnelFormData) => {
    try {
      await updateTunnel(tunnelId, {
        name: data.name,
        localAddress: data.localAddress,
        localHostname: data.localHostname || undefined,
      });
      Alert.alert('成功', '隧道已更新', [
        {
          text: '确定',
          onPress: () => router.back(),
        },
      ]);
    } catch {
      // Error handled by store
    }
  };

  if (isFetching || !initialData) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="编辑隧道" showBack onBack={() => router.back()} />
        <LoadingOverlay visible={true} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="编辑隧道" showBack onBack={() => router.back()} />

      <TunnelForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        initialData={initialData}
      />

      <LoadingOverlay visible={isLoading} message="保存中..." />

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
