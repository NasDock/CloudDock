import React, { useEffect, useState } from 'react';
import { StyleSheet, View, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, FAB, Snackbar, Dialog, Portal, Button, TextInput, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { LoadingOverlay } from '../components/ui/LoadingOverlay';
import { deviceApi } from '../api/device';
import { formatRelativeTime } from '../utils/formatters';
import type { Client } from '../api/device';

export default function DeviceListScreen() {
  const router = useRouter();

  const [devices, setDevices] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const fetchDevices = async () => {
    try {
      const response = await deviceApi.list();
      setDevices(response.clients);
    } catch {
      setError('获取设备列表失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDevices();
    setRefreshing(false);
  };

  const handleUnbind = (device: Client) => {
    Alert.alert(
      '解绑设备',
      `确定要解绑 "${device.name}" 吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '解绑',
          style: 'destructive',
          onPress: async () => {
            try {
              await deviceApi.unbind(device.clientId);
              setDevices((prev) => prev.filter((d) => d.clientId !== device.clientId));
            } catch {
              setError('解绑失败');
            }
          },
        },
      ]
    );
  };

  const openRename = (device: Client) => {
    setSelectedClient(device);
    setRenameValue(device.name);
    setRenameVisible(true);
  };

  const confirmRename = async () => {
    if (!selectedClient) return;
    const name = renameValue.trim();
    if (!name) return;
    try {
      const updated = await deviceApi.rename(selectedClient.clientId, name);
      setDevices((prev) =>
        prev.map((d) => (d.clientId === updated.clientId ? { ...d, name: updated.name } : d))
      );
      setRenameVisible(false);
    } catch {
      setError('修改名称失败');
    }
  };

  const renderItem = ({ item }: { item: Client }) => (
    <Card
      title={item.name}
      subtitle={item.enabled === false ? '已下线' : item.status === 'online' ? '在线' : '离线'}
      status={item.enabled === false ? 'offline' : item.status}
      right={<IconButton icon="pencil" size={18} onPress={() => openRename(item)} />}
      onPress={() => {}}
      onLongPress={() => handleUnbind(item)}
    >
      <View style={styles.infoRow}>
        <Text style={styles.label}>设备ID</Text>
        <Text style={styles.value}>{item.clientId}</Text>
      </View>
      {item.lastSeen && (
        <View style={styles.infoRow}>
          <Text style={styles.label}>最后在线</Text>
          <Text style={styles.value}>{formatRelativeTime(item.lastSeen)}</Text>
        </View>
      )}
    </Card>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>暂无设备</Text>
      <Text style={styles.emptySubtitle}>使用移动端扫码绑定 NAS 设备</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="设备管理" />

      <FlatList
        data={devices}
        renderItem={renderItem}
        keyExtractor={(item) => item.clientId}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      />

      <FAB
        icon="qrcode-scan"
        style={styles.fab}
        onPress={() => router.push('/qr-scan')}
        label="扫码绑定"
      />

      <LoadingOverlay visible={isLoading && !refreshing} />

      <Snackbar
        visible={!!error}
        onDismiss={() => setError(null)}
        duration={3000}
        style={styles.snackbar}
      >
        {error}
      </Snackbar>

      <Portal>
        <Dialog visible={renameVisible} onDismiss={() => setRenameVisible(false)}>
          <Dialog.Title>修改设备名称</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="设备名称"
              value={renameValue}
              onChangeText={setRenameValue}
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenameVisible(false)}>取消</Button>
            <Button onPress={confirmRename}>保存</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    minWidth: 60,
  },
  value: {
    fontSize: 12,
    color: '#374151',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 80,
    backgroundColor: '#6366F1',
  },
  snackbar: {
    backgroundColor: '#EF4444',
  },
});
