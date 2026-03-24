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

export default function LoginScreen() {
  const router = useRouter()
  const { auth, login, clearError } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

    if (!email.trim()) {
      newErrors.email = '请输入邮箱'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = '请输入有效的邮箱地址'
    }

    if (!password) {
      newErrors.password = '请输入密码'
    }
    if (!serverUrl.trim()) {
      newErrors.serverUrl = '请输入服务器地址'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleLogin = async () => {
    if (!validate()) return

    try {
      setApiBaseUrl(serverUrl.trim() || DEFAULT_API_BASE_URL)
      await login(email.trim(), password)
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
            <Text style={styles.title}>CloudDock</Text>
            <Text style={styles.subtitle}>内网穿透工具</Text>
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
              placeholder="••••••••"
              secureTextEntry
              error={errors.password}
            />

            <Button onPress={handleLogin} loading={auth.isLoading} disabled={auth.isLoading}>
              登录
            </Button>

            <Button
              onPress={() => router.push('/(auth)/register')}
              mode="outlined"
              disabled={auth.isLoading}
            >
              没有账号？去注册
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

      <LoadingOverlay visible={auth.isLoading} message="登录中..." />
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
    fontSize: 32,
    fontWeight: '700',
    color: '#6366F1',
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
