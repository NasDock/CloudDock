import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, FAB, SegmentedButtons, Searchbar, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/layout/Header';
import { TunnelCard } from '../components/tunnel/TunnelCard';
import { LoadingOverlay } from '../components/ui/LoadingOverlay';
import { useTunnel } from '../hooks/useTunnel';
import { deviceApi } from '../api/device';
import { tunnelApi } from '../api/tunnel';
import * as Clipboard from 'expo-clipboard';
import type { Tunnel } from '@cloud-dock/shared';

export default function TunnelListScreen() {
  const router = useRouter();
  const { tunnels, isLoading, refresh, deleteTunnel, setTunnelEnabled } = useTunnel();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});

  useEffect(() => {
    deviceApi.list().then((res) => {
      const map: Record<string, string> = {};
      res.clients.forEach((c) => { map[c.clientId] = c.name; });
      setClientNames(map);
    }).catch(() => {});
  }, []);

  const getEffectiveStatus = (tunnel: Tunnel) => ((tunnel as any).enabled === false ? 'offline' : tunnel.status);

  const filteredTunnels = tunnels.filter((tunnel) => {
    const matchesFilter = filter === 'all' || getEffectiveStatus(tunnel) === filter;
    const matchesSearch =
      !searchQuery ||
      tunnel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tunnel.localAddress.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleDelete = (tunnel: Tunnel) => {
    Alert.alert(
      '删除隧道',
      `确定要删除 "${tunnel.name}" 吗？此操作不可恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTunnel(tunnel.tunnelId);
            } catch {
              setError('删除失败');
            }
          },
        },
      ]
    );
  };

  const handleToggle = async (tunnel: Tunnel) => {
    try {
      await setTunnelEnabled(tunnel.tunnelId, (tunnel as any).enabled === false);
      refresh();
    } catch {
      setError('操作失败');
    }
  };

  const handleCopy = async (tunnel: Tunnel) => {
    const url = tunnelApi.getPublicUrl(tunnel.publicPath);
    await Clipboard.setStringAsync(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const renderItem = useCallback(
    ({ item }: { item: Tunnel }) => (
      <TunnelCard
        tunnel={item}
        publicUrl={tunnelApi.getPublicUrl(item.publicPath)}
        deviceName={item.clientId ? (clientNames[item.clientId] || '默认设备') : '默认设备'}
        onPress={() => router.push({ pathname: '/tunnel-detail', params: { tunnelId: item.tunnelId } })}
        onDelete={() => handleDelete(item)}
        onToggle={() => handleToggle(item)}
        onCopy={() => handleCopy(item)}
      />
    ),
    [router, clientNames]
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>没有找到隧道</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery ? '尝试其他搜索词' : '创建你的第一个隧道'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="隧道管理" />

      <View style={styles.filterContainer}>
        <Searchbar
          placeholder="搜索隧道..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        <SegmentedButtons
          value={filter}
          onValueChange={(value) => setFilter(value as typeof filter)}
          buttons={[
            { value: 'all', label: '全部' },
            { value: 'online', label: '在线' },
            { value: 'offline', label: '离线' },
          ]}
          style={styles.segmented}
        />
      </View>

      <FlatList
        data={filteredTunnels}
        renderItem={renderItem}
        keyExtractor={(item) => item.tunnelId}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/tunnel-create')}
      />

      <LoadingOverlay visible={isLoading && !refreshing} />

      <Snackbar
        visible={!!error || copied}
        onDismiss={() => {
          setError(null);
          setCopied(false);
        }}
        duration={1500}
        style={styles.snackbar}
      >
        {error || '已复制'}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  filterContainer: {
    padding: 16,
    gap: 12,
  },
  searchbar: {
    backgroundColor: '#FFFFFF',
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  segmented: {},
  listContent: {
    flexGrow: 1,
    paddingBottom: 100,
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
