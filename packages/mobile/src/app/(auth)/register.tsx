import { Redirect, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { Snackbar, Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { DEFAULT_API_BASE_URL, initApiBaseUrl, setApiBaseUrl } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { LoadingOverlay } from '../../components/ui/LoadingOverlay'
import { useAuth } from '../../hooks/useAuth'

export default function RegisterScreen() {
  const router = useRouter()
  const { auth, register, clearError } = useAuth()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [serverUrl, setServerUrl] = useState('https://cloud.audiodock.cn')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    initApiBaseUrl().then((base) => {
      const trimmed = base.replace(/\/api$/i, '')
      setServerUrl(trimmed || 'https://cloud.audiodock.cn')
    })
  }, [])

  // Redirect if already logged in
  if (auth.isAuthenticated) {
    return <Redirect href="/(tabs)" />
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!username.trim()) {
      newErrors.username = '请输入用户名'
    } else if (username.trim().length < 2) {
      newErrors.username = '用户名至少2个字符'
    }

    if (!email.trim()) {
      newErrors.email = '请输入邮箱'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = '请输入有效的邮箱地址'
    }

    if (!password) {
      newErrors.password = '请输入密码'
    } else if (password.length < 8) {
      newErrors.password = '密码至少8个字符'
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致'
    }
    if (!serverUrl.trim()) {
      newErrors.serverUrl = '请输入服务器地址'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleRegister = async () => {
    if (!validate()) return

    try {
      setApiBaseUrl(serverUrl.trim() || DEFAULT_API_BASE_URL)
      await register(email.trim(), password, username.trim())
      router.replace('/(tabs)')
    } catch {
      // Error handled by store
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always">
          <View style={styles.header}>
            <Text style={styles.title}>创建账号</Text>
            <Text style={styles.subtitle}>开始使用 CloudDock</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="服务器地址"
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="https://cloud.audiodock.cn"
              autoCapitalize="none"
              error={errors.serverUrl}
            />

            <Input
              label="用户名"
              value={username}
              onChangeText={setUsername}
              placeholder="你的名字"
              autoCapitalize="words"
              error={errors.username}
            />

            <Input
              label="邮箱"
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />

            <Input
              label="密码"
              value={password}
              onChangeText={setPassword}
              placeholder="至少8个字符"
              secureTextEntry
              error={errors.password}
            />

            <Input
              label="确认密码"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="再次输入密码"
              secureTextEntry
              error={errors.confirmPassword}
            />

            <Button onPress={handleRegister} loading={auth.isLoading} disabled={auth.isLoading}>
              注册
            </Button>

            <Button onPress={() => router.back()} mode="outlined" disabled={auth.isLoading}>
              已有账号？去登录
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Snackbar
        visible={!!auth.error}
        onDismiss={clearError}
        duration={3000}
        style={styles.snackbar}
      >
        {auth.error}
      </Snackbar>

      <LoadingOverlay visible={auth.isLoading} message="注册中..." />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  form: {
    gap: 8,
  },
  snackbar: {
    backgroundColor: '#EF4444',
  },
})
