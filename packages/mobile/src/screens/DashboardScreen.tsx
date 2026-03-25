import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { FAB, Snackbar, Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { deviceApi } from '../api/device'
import { requestDeviceApi } from '../api/request-device'
import { tunnelApi } from '../api/tunnel'
import { Header } from '../components/layout/Header'
import { TunnelCard } from '../components/tunnel/TunnelCard'
import { Card } from '../components/ui/Card'
import { LoadingOverlay } from '../components/ui/LoadingOverlay'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useAuth } from '../hooks/useAuth'
import { usePushNotification } from '../hooks/usePushNotification'
import { useTunnel } from '../hooks/useTunnel'
import type { RequestDevice } from '../api/request-device'

export default function DashboardScreen() {
  const router = useRouter()
  const { auth, logout } = useAuth()
  const { tunnels, onlineTunnels, offlineTunnels, isLoading, refresh } = useTunnel()

  usePushNotification()

  const [refreshing, setRefreshing] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [clientNames, setClientNames] = useState<Record<string, string>>({})
  const [pendingDevices, setPendingDevices] = useState<RequestDevice[]>([])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refresh()
    try {
      const res = await requestDeviceApi.list()
      setPendingDevices(res.devices.filter((d) => d.status === 'pending'))
    } catch {}
    setRefreshing(false)
  }

  const handleLogout = async () => {
    try {
      await logout()
      router.replace('/login')
    } catch {
      setLogoutError('登出失败')
    }
  }

  // Watch for tunnel status changes and send notifications
  useEffect(() => {
    // This would be connected to WebSocket for real-time updates
  }, [tunnels])

  useEffect(() => {
    deviceApi
      .list()
      .then((res) => {
        const map: Record<string, string> = {}
        res.clients.forEach((c) => {
          map[c.clientId] = c.name || '默认设备'
        })
        setClientNames(map)
      })
      .catch(() => {})

    requestDeviceApi
      .list()
      .then((res) => {
        setPendingDevices(res.devices.filter((d) => d.status === 'pending'))
      })
      .catch(() => {})
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="CloudDock"
        subtitle={auth.user?.username}
        right={
          <View style={styles.headerRight}>
            <StatusBadge
              status={onlineTunnels.length > 0 ? 'online' : 'offline'}
              label={`${onlineTunnels.length} 在线`}
            />
          </View>
        }
      />

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Stats Cards */}
        <Card style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{tunnels.length}</Text>
              <Text style={styles.statLabel}>全部隧道</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#10B981' }]}>{onlineTunnels.length}</Text>
              <Text style={styles.statLabel}>在线</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#6B7280' }]}>{offlineTunnels.length}</Text>
              <Text style={styles.statLabel}>离线</Text>
            </View>
          </View>
        </Card>

        {/* Pending Devices */}
        {pendingDevices.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>需要审批的设备</Text>
              <Text style={styles.seeAll} onPress={() => router.push('/devices')}>
                去处理
              </Text>
            </View>
            <Card>
              {pendingDevices.slice(0, 3).map((device) => (
                <View key={device.deviceId} style={styles.pendingRow}>
                  <Text style={styles.pendingName}>{device.name || '未知设备'}</Text>
                  <Text style={styles.pendingMeta}>{device.platform || 'unknown'}</Text>
                </View>
              ))}
              {pendingDevices.length > 3 && (
                <Text style={styles.pendingMore}>还有 {pendingDevices.length - 3} 台设备待审批</Text>
              )}
            </Card>
          </View>
        )}

        {/* Recent Tunnels */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>最近隧道</Text>
            <Text style={styles.seeAll} onPress={() => router.push('/tunnels')}>
              查看全部
            </Text>
          </View>

          {tunnels.length === 0 ? (
            <Card>
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>暂无隧道</Text>
                <Text style={styles.emptySubtitle}>创建你的第一个隧道来暴露本地服务</Text>
              </View>
            </Card>
          ) : (
            tunnels
              .slice(0, 3)
              .map((tunnel) => (
                <TunnelCard
                  key={tunnel.tunnelId}
                  tunnel={tunnel}
                  publicUrl={tunnelApi.getPublicUrl(tunnel.publicPath)}
                  deviceName={
                    tunnel.clientId ? clientNames[tunnel.clientId] || '默认设备' : '默认设备'
                  }
                  onPress={() =>
                    router.push({
                      pathname: '/tunnel-detail',
                      params: { tunnelId: tunnel.tunnelId },
                    })
                  }
                />
              ))
          )}
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Card onPress={() => router.push('/profile')} style={styles.accountCard}>
            <View style={styles.accountInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {auth.user?.username?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
              <View>
                <Text style={styles.accountName}>{auth.user?.username}</Text>
                <Text style={styles.accountEmail}>{auth.user?.email}</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Card>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <FAB icon="plus" style={styles.fab} onPress={() => router.push('/tunnel-create')} />

      <LoadingOverlay visible={isLoading && !refreshing} />

      <Snackbar
        visible={!!logoutError}
        onDismiss={() => setLogoutError(null)}
        duration={3000}
        style={styles.snackbar}
      >
        {logoutError}
      </Snackbar>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerRight: {
    marginRight: 8,
  },
  content: {
    flex: 1,
  },
  statsCard: {
    marginHorizontal: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  pendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pendingName: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  pendingMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  pendingMore: {
    fontSize: 12,
    color: '#6B7280',
    paddingTop: 6,
  },
  seeAll: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  accountCard: {
    marginHorizontal: 16,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  accountEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    color: '#9CA3AF',
    position: 'absolute',
    right: 16,
    top: '50%',
  },
  bottomPadding: {
    height: 100,
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
})
