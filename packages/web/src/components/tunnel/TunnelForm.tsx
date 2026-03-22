import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { createTunnelSchema } from '@/utils/validators';
import type { CreateTunnelInput } from '@/utils/validators';

interface TunnelFormProps {
  onSubmit: SubmitHandler<CreateTunnelInput>;
  onCancel?: () => void;
  isLoading?: boolean;
  defaultValues?: Partial<CreateTunnelInput>;
  clients?: { clientId: string; name: string; enabled?: boolean }[];
}

export const TunnelForm = ({ onSubmit, onCancel, isLoading, defaultValues, clients }: TunnelFormProps) => {
  const form = useForm<CreateTunnelInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createTunnelSchema) as any,
    defaultValues: defaultValues ?? {},
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, formState: { errors } } = form;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getFieldProps = (name: keyof CreateTunnelInput): any => {
    return register(name);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {clients && clients.length > 0 && (
        <div>
          <label className="label">设备</label>
          <select
            className="w-full px-3 py-2 border rounded-lg border-gray-300 focus:ring-primary-500 focus:border-primary-500"
            {...getFieldProps('clientId')}
            defaultValue={defaultValues?.clientId || clients[0]?.clientId || ''}
          >
            {clients.map((client) => (
              <option key={client.clientId} value={client.clientId}>
                {client.name}{client.enabled === false ? '（已下线）' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      <Input
        label="隧道名称"
        placeholder="例如：我的NAS管理后台"
        error={errors.name?.message as string | undefined}
        {...getFieldProps('name')}
      />

      <div>
        <label className="label">协议类型</label>
        <div className="flex gap-4">
          {(['http', 'tcp', 'udp'] as const).map((protocol) => (
            <label key={protocol} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value={protocol}
                {...getFieldProps('protocol')}
                className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">
                {protocol.toUpperCase()}
              </span>
            </label>
          ))}
        </div>
        {errors.protocol && (
          <p className="mt-1 text-sm text-danger-500">{errors.protocol.message as string}</p>
        )}
      </div>

      <Input
        label="本地服务地址"
        placeholder="例如：192.168.1.100:5000"
        error={errors.localAddress?.message as string | undefined}
        hint="格式：host:port"
        {...getFieldProps('localAddress')}
      />

      <Input
        label="本地 Host（可选）"
        placeholder="例如：nas.example.com"
        error={errors.localHostname?.message as string | undefined}
        hint="仅 HTTP 协议使用，用于保持原始 Host 头"
        {...getFieldProps('localHostname')}
      />

      <Input
        label="IP 白名单（可选）"
        placeholder="例如：1.2.3.4, 5.6.7.8"
        error={errors.ipWhitelist?.message as string | undefined}
        hint="留空表示允许所有 IP 访问，多个 IP 用逗号分隔"
        {...getFieldProps('ipWhitelist')}
      />

      <div className="flex items-center justify-end gap-3 pt-4">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="submit" isLoading={isLoading ?? false}>
          创建隧道
        </Button>
      </div>
    </form>
  );
};
