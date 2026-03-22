import React, { useState } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { Text, Button, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { LoadingOverlay } from '../components/ui/LoadingOverlay';
import { deviceApi } from '../api/device';

export default function QRScanScreen() {
  const router = useRouter();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isBinding, setIsBinding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isBinding) return;
    setScanned(true);

    try {
      // Parse QR code data (bindToken format: "XXXX.YYYY.ZZZZ")
      const bindToken = data.trim();

      if (!bindToken || !bindToken.includes('.')) {
        setError('无效的二维码');
        setScanned(false);
        return;
      }

      setIsBinding(true);

      // Bind device
      const device = await deviceApi.bind({
        bindToken,
        deviceName: `手机 ${Date.now()}`,
      });

      Alert.alert('绑定成功', `设备 "${device.name}" 已绑定`, [
        { text: '确定', onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      const message = error.response?.data?.error?.message || error.message || '绑定失败';
      setError(message);
      setScanned(false);
    } finally {
      setIsBinding(false);
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="扫码绑定" showBack onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={styles.message}>请求相机权限中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="扫码绑定" showBack onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={styles.message}>需要相机权限来扫描二维码</Text>
          <Button mode="contained" onPress={requestPermission} style={styles.permissionButton}>
            授予权限
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="扫码绑定" showBack onBack={() => router.back()} />

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
        </View>
      </View>

      <View style={styles.instructions}>
        <Card>
          <Text style={styles.instructionsTitle}>扫码说明</Text>
          <Text style={styles.instructionsText}>
            1. 在 NAS 管理界面生成绑定二维码{'\n'}
            2. 将二维码对准相机{'\n'}
            3. 确认绑定请求
          </Text>
        </Card>
      </View>

      {scanned && !isBinding && (
        <Button
          mode="contained"
          onPress={() => setScanned(false)}
          style={styles.rescanButton}
        >
          重新扫描
        </Button>
      )}

      <LoadingOverlay visible={isBinding} message="绑定中..." />

      <Snackbar
        visible={!!error}
        onDismiss={() => {
          setError(null);
          setScanned(false);
        }}
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
    backgroundColor: '#000000',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  message: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionButton: {
    backgroundColor: '#6366F1',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#6366F1',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  instructions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  rescanButton: {
    position: 'absolute',
    bottom: 160,
    left: 16,
    right: 16,
    backgroundColor: '#6366F1',
  },
  snackbar: {
    backgroundColor: '#EF4444',
  },
});
