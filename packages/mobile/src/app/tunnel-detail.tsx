import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import { Text, IconButton, Snackbar, Button } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingOverlay } from '../components/ui/LoadingOverlay';
import { useTunnel } from '../hooks/useTunnel';
import { tunnelApi } from '../api/tunnel';
import { formatNumber, formatBytes } from '../utils/formatters';
import type { Tunnel, TunnelStatistics } from '@cloud-dock/shared';
import * as Clipboard from 'expo-clipboard';

export default function TunnelDetailScreen() {
  const { tunnelId } = useLocalSearchParams<{ tunnelId: string }>();
  const router = useRouter();
  const { deleteTunnel, setTunnelEnabled } = useTunnel();

  const [tunnel, setTunnel] = useState<Tunnel | null>(null);
  const [stats, setStats] = useState<TunnelStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<Array<{ logId: string; timestamp: string; clientIp: string; method: string; path: string; statusCode: number; responseTime: number }>>([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const logLimit = 20;

  useEffect(() => {
    fetchTunnelDetail();
    setLogPage(1);
  }, [tunnelId]);

  useEffect(() => {
    fetchLogs();
  }, [tunnelId, logPage]);

  const fetchTunnelDetail = async () => {
    if (!tunnelId) return;
    setIsLoading(true);
    try {
      const data = await tunnelApi.get(tunnelId);
      setTunnel(data);
      setStats(data.statistics);
    } catch {
      setError('获取隧道详情失败');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    if (!tunnelId) return;
    try {
      const logResp = await tunnelApi.getLogs(tunnelId, { page: logPage, limit: logLimit });
      setLogs(logResp.logs);
      setLogTotal(logResp.pagination.total);
    } catch {
      setError('获取访问日志失败');
    }
  };

  const handleCopyUrl = async () => {
    if (!tunnel) return;
    const url = tunnelApi.getPublicUrl(tunnel.publicPath);
    try {
      await Clipboard.setStringAsync(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('复制失败');
    }
  };

  const handleToggle = async () => {
    if (!tunnel) return;
    try {
      await setTunnelEnabled(tunnel.tunnelId, (tunnel as any).enabled === false);
      await fetchTunnelDetail();
    } catch {
      setError('操作失败');
    }
  };

  const handleDelete = () => {
    if (!tunnel) return;
    Alert.alert(
      '删除隧道',
      `确定要删除 "${tunnel.name}" 吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTunnel(tunnel.tunnelId);
              router.back();
            } catch {
              setError('删除失败');
            }
          },
        },
      ]
    );
  };

  if (isLoading || !tunnel) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="隧道详情" showBack onBack={() => router.back()} />
        <LoadingOverlay visible={true} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Header
        title={tunnel.name}
        showBack
        onBack={() => router.back()}
        compact
        right={
          <View style={styles.headerActions}>
            <StatusBadge status={(tunnel as any).enabled === false ? 'offline' : tunnel.status} label={(tunnel as any).enabled === false ? '已下线' : tunnel.status === 'online' ? '在线' : '离线'} />
            <IconButton icon="power" size={18} onPress={handleToggle} />
            <IconButton icon="trash-can-outline" size={18} onPress={handleDelete} />
          </View>
        }
      />

      <ScrollView style={styles.content}>
        {/* Access Info */}
        <Card title="访问信息">
          <View style={styles.infoRow}>
            <Text style={styles.label}>访问路径</Text>
            <View style={styles.valueRow}>
              <Text style={styles.value} numberOfLines={1}>
                {tunnelApi.getPublicUrl(tunnel.publicPath)}
              </Text>
              <IconButton icon="content-copy" size={16} onPress={handleCopyUrl} />
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>协议</Text>
            <Text style={styles.value}>{tunnel.protocol.toUpperCase()}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>本地地址</Text>
            <Text style={styles.value}>{tunnel.localAddress}</Text>
          </View>
          {tunnel.localHostname && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>本地 Host</Text>
              <Text style={styles.value}>{tunnel.localHostname}</Text>
            </View>
          )}
        </Card>

        {/* Statistics */}
        {stats && (
          <Card title="流量统计">
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatNumber(stats.totalRequests)}</Text>
                <Text style={styles.statLabel}>总请求</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatBytes(stats.bytesIn)}</Text>
                <Text style={styles.statLabel}>入站流量</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatBytes(stats.bytesOut)}</Text>
                <Text style={styles.statLabel}>出站流量</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Access Logs */}
        <Card title="访问日志">
          {logs.length === 0 ? (
            <Text style={styles.emptyLogs}>暂无访问日志</Text>
          ) : (
            logs.map((log) => (
              <View key={log.logId} style={styles.logRow}>
                <View style={styles.logLeft}>
                  <Text style={styles.logPath} numberOfLines={1}>{log.path}</Text>
                  <Text style={styles.logMeta}>{log.method} • {log.clientIp}</Text>
                </View>
                <View style={styles.logRight}>
                  <Text style={styles.logStatus}>{log.statusCode}</Text>
                  <Text style={styles.logTime}>{log.responseTime}ms</Text>
                </View>
              </View>
            ))
          )}
          {logTotal > logLimit && (
            <View style={styles.pagination}>
              <Button mode="outlined" compact disabled={logPage <= 1} onPress={() => setLogPage((p) => Math.max(1, p - 1))}>
                上一页
              </Button>
              <Text style={styles.pageText}>
                {logPage} / {Math.ceil(logTotal / logLimit)}
              </Text>
              <Button mode="outlined" compact disabled={logPage >= Math.ceil(logTotal / logLimit)} onPress={() => setLogPage((p) => p + 1)}>
                下一页
              </Button>
            </View>
          )}
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <LoadingOverlay visible={isLoading} />

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
  content: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    width: 72,
  },
  value: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    marginLeft: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  emptyLogs: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  logLeft: {
    flex: 1,
    marginRight: 8,
  },
  logPath: {
    fontSize: 12,
    color: '#111827',
  },
  logMeta: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  logRight: {
    alignItems: 'flex-end',
  },
  logStatus: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  logTime: {
    fontSize: 11,
    color: '#6B7280',
  },
  pagination: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageText: {
    fontSize: 12,
    color: '#6B7280',
  },
  bottomPadding: {
    height: 40,
  },
  snackbar: {
    backgroundColor: '#EF4444',
  },
});
