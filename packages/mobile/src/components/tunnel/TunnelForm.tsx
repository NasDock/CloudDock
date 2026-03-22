import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import { Text, SegmentedButtons } from 'react-native-paper';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { Protocol } from '@cloud-dock/shared';

interface TunnelFormData {
  name: string;
  protocol: Protocol;
  localAddress: string;
  localHostname?: string;
}

interface TunnelFormProps {
  initialData?: Partial<TunnelFormData>;
  onSubmit: (data: TunnelFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function TunnelForm({ initialData, onSubmit, onCancel, isLoading }: TunnelFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [protocol, setProtocol] = useState<Protocol>(initialData?.protocol || 'http');
  const [localAddress, setLocalAddress] = useState(initialData?.localAddress || '');
  const [localHostname, setLocalHostname] = useState(initialData?.localHostname || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = '请输入隧道名称';
    }

    if (!localAddress.trim()) {
      newErrors.localAddress = '请输入本地服务地址';
    } else if (!/^[\w.-]+:\d+$/.test(localAddress.trim())) {
      newErrors.localAddress = '格式应为 host:port，例如 192.168.1.100:5000';
    }

    if (protocol === 'http' && !localHostname?.trim()) {
      // localHostname is optional but recommended for HTTP
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      await onSubmit({
        name: name.trim(),
        protocol,
        localAddress: localAddress.trim(),
        localHostname: localHostname.trim() || undefined,
      });
    } catch {
      // Error handled by parent
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>基本信息</Text>

      <Input
        label="隧道名称"
        value={name}
        onChangeText={setName}
        placeholder="例如：我的NAS管理后台"
        error={errors.name}
      />

      <Text style={styles.sectionTitle}>协议类型</Text>
      <SegmentedButtons
        value={protocol}
        onValueChange={(value) => setProtocol(value as Protocol)}
        buttons={[
          { value: 'http', label: 'HTTP' },
          { value: 'tcp', label: 'TCP' },
          { value: 'udp', label: 'UDP' },
        ]}
        style={styles.segmented}
      />

      <Text style={styles.sectionTitle}>本地服务</Text>

      <Input
        label="本地地址"
        value={localAddress}
        onChangeText={setLocalAddress}
        placeholder="192.168.1.100:5000"
        error={errors.localAddress}
        keyboardType="default"
      />

      {protocol === 'http' && (
        <Input
          label="本地 Host (可选)"
          value={localHostname}
          onChangeText={setLocalHostname}
          placeholder="nas.example.com"
        />
      )}

      <View style={styles.actions}>
        <Button
          onPress={handleSubmit}
          loading={isLoading}
          disabled={isLoading}
        >
          {initialData?.name ? '保存修改' : '创建隧道'}
        </Button>
        {onCancel && (
          <Button
            onPress={onCancel}
            mode="outlined"
            disabled={isLoading}
          >
            取消
          </Button>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  segmented: {
    marginBottom: 8,
  },
  actions: {
    marginTop: 24,
    gap: 8,
  },
});
