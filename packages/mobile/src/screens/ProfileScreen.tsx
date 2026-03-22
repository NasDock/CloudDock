import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import { Text, List, Divider, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingOverlay } from '../components/ui/LoadingOverlay';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../utils/formatters';

export default function ProfileScreen() {
  const router = useRouter();
  const { auth, logout } = useAuth();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/login');
    } catch {
      setError('登出失败');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="个人中心" />

      <ScrollView style={styles.content}>
        {/* User Info */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {auth.user?.username?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.username}>{auth.user?.username}</Text>
              <Text style={styles.email}>{auth.user?.email}</Text>
            </View>
          </View>
          <View style={styles.planBadge}>
            <Text style={styles.planText}>
              {auth.user?.plan === 'free' ? '免费版' : auth.user?.plan === 'pro' ? '专业版' : '企业版'}
            </Text>
          </View>
        </Card>

        {/* Account Info */}
        <Card title="账号信息">
          <View style={styles.infoRow}>
            <Text style={styles.label}>用户ID</Text>
            <Text style={styles.value}>{auth.user?.userId}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>注册时间</Text>
            <Text style={styles.value}>
              {auth.user?.createdAt ? formatDate(auth.user.createdAt) : '-'}
            </Text>
          </View>
        </Card>

        {/* Settings */}
        <Card title="设置">
          <List.Item
            title="编辑资料"
            description="修改用户名"
            left={(props) => <List.Icon {...props} icon="account-edit" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => Alert.alert('提示', '该功能开发中')}
          />
          <Divider />
          <List.Item
            title="修改密码"
            description="更新登录密码"
            left={(props) => <List.Icon {...props} icon="lock-reset" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => Alert.alert('提示', '该功能开发中')}
          />
          <Divider />
          <List.Item
            title="通知设置"
            description="推送通知偏好"
            left={(props) => <List.Icon {...props} icon="bell" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => Alert.alert('提示', '该功能开发中')}
          />
        </Card>

        {/* About */}
        <Card title="关于">
          <List.Item
            title="使用条款"
            left={(props) => <List.Icon {...props} icon="file-document" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => Alert.alert('提示', '该功能开发中')}
          />
          <Divider />
          <List.Item
            title="隐私政策"
            left={(props) => <List.Icon {...props} icon="shield-account" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => Alert.alert('提示', '该功能开发中')}
          />
          <Divider />
          <List.Item
            title="版本信息"
            description="v1.0.0"
            left={(props) => <List.Icon {...props} icon="information" />}
          />
        </Card>

        {/* Logout */}
        <View style={styles.logoutSection}>
          <Button onPress={handleLogout} variant="danger" loading={auth.isLoading}>
            退出登录
          </Button>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <LoadingOverlay visible={auth.isLoading} />

      <Snackbar
        visible={!!error}
        onDismiss={() => setError(null)}
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
  content: {
    flex: 1,
  },
  profileCard: {
    marginTop: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
  },
  planBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  planText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
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
  },
  value: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  logoutSection: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  bottomPadding: {
    height: 40,
  },
  snackbar: {
    backgroundColor: '#EF4444',
  },
});
