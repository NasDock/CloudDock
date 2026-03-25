import React, { useEffect, useState } from 'react';
import { StyleSheet, View, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, FAB, Snackbar, Dialog, Portal, Button, TextInput, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { LoadingOverlay } from '../components/ui/LoadingOverlay';
import { deviceApi } from '../api/device';
import { requestDeviceApi } from '../api/request-device';
import { formatRelativeTime } from '../utils/formatters';
import type { Client } from '../api/device';
import type { RequestDevice } from '../api/request-device';

export default function DeviceListScreen() {
  const router = useRouter();

  const [devices, setDevices] = useState<Client[]>([]);
  const [requestDevices, setRequestDevices] = useState<RequestDevice[]>([]);
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
      const requestDeviceResponse = await requestDeviceApi.list();
      setRequestDevices(requestDeviceResponse.devices);
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

  const renderRequestDeviceCard = (item: RequestDevice) => {
    const statusLabel = item.status === 'approved' ? '已允许' : item.status === 'blocked' ? '已禁止' : '待审批';
    const status = item.status === 'approved' ? 'online' : 'offline';
    return (
      <Card
        key={item.deviceId}
        title={item.name || '未知设备'}
        subtitle={statusLabel}
        status={status}
        statusLabel={statusLabel}
        style={styles.requestCard}
      >
        <View style={styles.infoRow}>
          <Text style={styles.label}>设备ID</Text>
          <Text style={styles.value}>{item.deviceId}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>平台</Text>
          <Text style={styles.value}>{item.platform || '-'}</Text>
        </View>
        {item.lastSeen && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>最近访问</Text>
            <Text style={styles.value}>{formatRelativeTime(item.lastSeen)}</Text>
          </View>
        )}
        <View style={styles.actionRow}>
          {item.status !== 'approved' && (
            <Button
              mode="outlined"
              onPress={async () => {
                try {
                  const updated = await requestDeviceApi.updateStatus(item.deviceId, 'approved');
                  setRequestDevices((prev) => prev.map((d) => (d.deviceId === updated.deviceId ? updated : d)));
                } catch {
                  setError('允许失败');
                }
              }}
            >
              允许
            </Button>
          )}
          {item.status !== 'blocked' && (
            <Button
              mode="outlined"
              onPress={async () => {
                try {
                  const updated = await requestDeviceApi.updateStatus(item.deviceId, 'blocked');
                  setRequestDevices((prev) => prev.map((d) => (d.deviceId === updated.deviceId ? updated : d)));
                } catch {
                  setError('禁止失败');
                }
              }}
            >
              禁止
            </Button>
          )}
          <Button
            mode="outlined"
            onPress={async () => {
              try {
                await requestDeviceApi.remove(item.deviceId);
                setRequestDevices((prev) => prev.filter((d) => d.deviceId !== item.deviceId));
              } catch {
                setError('删除失败');
              }
            }}
          >
            删除
          </Button>
        </View>
      </Card>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>暂无 NAS 设备</Text>
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
        ListHeaderComponent={
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>NAS 设备</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.section}>
            <View style={styles.sectionDivider} />
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>访问设备</Text>
              <Text style={styles.sectionSubtitle}>新设备需要审批后才可访问</Text>
            </View>
            {requestDevices.length === 0 ? (
              <Card title="暂无访问设备" subtitle="等待新的客户端访问" />
            ) : (
              requestDevices.map((device) => renderRequestDeviceCard(device))
            )}
          </View>
        }
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
    paddingBottom: 140,
  },
  section: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 16,
    marginTop: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 16,
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
  },
  requestCard: {
    marginVertical: 6,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
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
