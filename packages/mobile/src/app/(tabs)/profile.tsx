import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import { Text, List, Divider, Snackbar, Portal, Modal, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingOverlay } from '../../components/ui/LoadingOverlay';
import { useAuth } from '../../hooks/useAuth';
import { userApi } from '../../api/user';

export default function ProfileScreen() {
  const router = useRouter();
  const { auth, logout, checkAuth } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit profile state
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Change password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/(auth)/login');
    } catch {
      setError('登出失败');
    }
  };

  const handleEditProfile = async () => {
    if (!editUsername.trim()) {
      setError('用户名不能为空');
      return;
    }
    setEditLoading(true);
    try {
      await userApi.updateProfile({ username: editUsername.trim() });
      await checkAuth();
      setShowEditProfile(false);
      setSuccess('资料更新成功');
    } catch (err: any) {
      setError(err?.message || '更新资料失败');
    } finally {
      setEditLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      setError('请填写完整信息');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    if (newPassword.length < 6) {
      setError('新密码至少6个字符');
      return;
    }
    setPasswordLoading(true);
    try {
      await userApi.changePassword({ oldPassword, newPassword });
      setShowChangePassword(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('密码修改成功');
    } catch (err: any) {
      setError(err?.message || '修改密码失败');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
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
              <View style={styles.usernameRow}>
                <Text style={styles.username}>{auth.user?.username}</Text>
                <View style={styles.planBadge}>
                  <Text style={styles.planText}>
                    {auth.user?.plan === 'pro' ? 'Plus' : '免费版'}
                  </Text>
                </View>
              </View>
              <Text style={styles.email}>{auth.user?.email}</Text>
            </View>
          </View>
        </Card>

        {/* Membership Plan */}
        <Card title="会员计划">
          <View style={styles.planSection}>
            <View style={styles.currentPlanRow}>
              <Text style={styles.currentPlanLabel}>当前方案</Text>
              <View style={[
                styles.currentPlanBadge,
                auth.user?.plan === 'pro' && styles.currentPlanBadgePro,
              ]}>
                <Text style={[
                  styles.currentPlanBadgeText,
                  auth.user?.plan === 'pro' && styles.currentPlanBadgeTextPro,
                ]}>
                  {auth.user?.plan === 'pro' ? 'Plus' : '免费版'}
                </Text>
              </View>
            </View>

            <View style={styles.planFeatures}>
              <View style={styles.planFeatureRow}>
                <Text style={styles.planFeatureIcon}>⚡</Text>
                <Text style={styles.planFeatureText}>
                  转发速率: {auth.user?.plan === 'pro' ? '最高 12 Mbps' : '最高 3 Mbps'}
                </Text>
              </View>
              <View style={styles.planFeatureRow}>
                <Text style={styles.planFeatureIcon}>🔗</Text>
                <Text style={styles.planFeatureText}>P2P 直连不限速</Text>
              </View>
              <View style={styles.planFeatureRow}>
                <Text style={styles.planFeatureIcon}>🚇</Text>
                <Text style={styles.planFeatureText}>不限隧道数量</Text>
              </View>
              <View style={styles.planFeatureRow}>
                <Text style={styles.planFeatureIcon}>📱</Text>
                <Text style={styles.planFeatureText}>不限设备数量</Text>
              </View>
            </View>

            {auth.user?.plan !== 'pro' && (
              <View style={styles.upgradeSection}>
                <Divider style={styles.upgradeDivider} />
                <Text style={styles.upgradeTitle}>升级 Plus 解锁更快转发速率</Text>
                <View style={styles.pricingRow}>
                  <View style={styles.pricingCard}>
                    <Text style={styles.pricingAmount}>¥8</Text>
                    <Text style={styles.pricingPeriod}>/月</Text>
                  </View>
                  <View style={styles.pricingCard}>
                    <Text style={styles.pricingAmount}>¥90</Text>
                    <Text style={styles.pricingPeriod}>/年</Text>
                    <View style={styles.saveBadge}>
                      <Text style={styles.saveText}>省 ¥6</Text>
                    </View>
                  </View>
                </View>
                <Button
                  onPress={() => Alert.alert('提示', '支付功能即将上线')}
                  style={styles.upgradeButton}
                >
                  升级 Plus
                </Button>
              </View>
            )}
          </View>
        </Card>

        {/* Settings */}
        <Card title="设置">
          <List.Item
            title="编辑资料"
            description="修改用户名"
            left={(props) => <List.Icon {...props} icon="account-edit" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {
              setEditUsername(auth.user?.username || '');
              setShowEditProfile(true);
            }}
          />
          <Divider />
          <List.Item
            title="修改密码"
            description="更新登录密码"
            left={(props) => <List.Icon {...props} icon="lock-reset" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => setShowChangePassword(true)}
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

      {/* Edit Profile Modal */}
      <Portal>
        <Modal
          visible={showEditProfile}
          onDismiss={() => setShowEditProfile(false)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>编辑资料</Text>
          <TextInput
            label="用户名"
            value={editUsername}
            onChangeText={setEditUsername}
            mode="outlined"
            style={styles.input}
          />
          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setShowEditProfile(false)}>
              取消
            </Button>
            <Button onPress={handleEditProfile} loading={editLoading} disabled={editLoading}>
              保存
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Change Password Modal */}
      <Portal>
        <Modal
          visible={showChangePassword}
          onDismiss={() => setShowChangePassword(false)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>修改密码</Text>
          <TextInput
            label="当前密码"
            value={oldPassword}
            onChangeText={setOldPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
          />
          <TextInput
            label="新密码"
            value={newPassword}
            onChangeText={setNewPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
          />
          <TextInput
            label="确认新密码"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
          />
          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={() => {
                setShowChangePassword(false);
                setOldPassword('');
                setNewPassword('');
                setConfirmPassword('');
              }}
            >
              取消
            </Button>
            <Button onPress={handleChangePassword} loading={passwordLoading} disabled={passwordLoading}>
              确认修改
            </Button>
          </View>
        </Modal>
      </Portal>

      <Snackbar
        visible={!!error}
        onDismiss={() => setError(null)}
        duration={3000}
        style={styles.snackbar}
      >
        {error}
      </Snackbar>

      <Snackbar
        visible={!!success}
        onDismiss={() => setSuccess(null)}
        duration={3000}
        style={styles.successSnackbar}
      >
        {success}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingBottom: 100,
  },
  content: {
    flex: 1,
    minHeight: '100%',
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
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
  },
  planBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
  },
  planText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
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
  successSnackbar: {
    backgroundColor: '#10B981',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 12,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  planSection: {
    paddingVertical: 4,
  },
  currentPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  currentPlanLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  currentPlanBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentPlanBadgePro: {
    backgroundColor: '#EDE9FE',
  },
  currentPlanBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  currentPlanBadgeTextPro: {
    color: '#7C3AED',
  },
  planFeatures: {
    gap: 10,
  },
  planFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planFeatureIcon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  planFeatureText: {
    fontSize: 14,
    color: '#374151',
  },
  upgradeSection: {
    marginTop: 4,
  },
  upgradeDivider: {
    marginVertical: 16,
  },
  upgradeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  pricingRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  pricingCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pricingAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  pricingPeriod: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  saveBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 6,
  },
  saveText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  upgradeButton: {
    marginTop: 4,
  },
});
