import { useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientApi } from '@/api/client';
import { requestDeviceApi } from '@/api/requestDevice';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';

export const DeviceList = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'access' | 'clients'>('access');
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; clientId?: string; name?: string }>({
    isOpen: false,
  });
  const [renameValue, setRenameValue] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => clientApi.list(),
  });

  const { data: requestDeviceData, isLoading: requestDeviceLoading } = useQuery({
    queryKey: ['request-devices'],
    queryFn: async () => requestDeviceApi.list(),
  });

  const updateRequestDeviceSettingsMutation = useMutation({
    mutationFn: (autoApproveNewRequestDevices: boolean) =>
      requestDeviceApi.updateSettings({ autoApproveNewRequestDevices }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request-devices'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ clientId, enabled }: { clientId: string; enabled: boolean }) =>
      clientApi.setEnabled(clientId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ clientId, name }: { clientId: string; name: string }) =>
      clientApi.rename(clientId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setRenameModal({ isOpen: false });
    },
  });

  const updateRequestDeviceMutation = useMutation({
    mutationFn: ({ deviceId, status }: { deviceId: string; status: 'approved' | 'blocked' }) =>
      requestDeviceApi.updateStatus(deviceId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request-devices'] });
    },
  });

  const deleteRequestDeviceMutation = useMutation({
    mutationFn: (deviceId: string) => requestDeviceApi.remove(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request-devices'] });
    },
  });

  const autoApproveNewRequestDevices = requestDeviceData?.settings.autoApproveNewRequestDevices ?? true;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1">
          <PageContainer title="防火墙" subtitle="访问控制与客户端管理">
            <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 mb-6">
              <button
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'access'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setActiveTab('access')}
              >
                访问控制
              </button>
              <button
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'clients'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setActiveTab('clients')}
              >
                客户端
              </button>
            </div>

            {activeTab === 'clients' ? (
              isLoading ? (
                <div className="text-center py-12 text-gray-500">加载中...</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {data?.clients?.map((client) => (
                    <Card key={client.clientId} padding="none" hover>
                      <div className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium text-gray-900">{client.name}</h3>
                            <p className="text-sm text-gray-500 mt-0.5">{client.clientId}</p>
                          </div>
                          <StatusBadge
                            status={client.enabled === false ? 'offline' : client.status}
                            label={client.enabled === false ? '已下线' : client.status === 'online' ? '在线' : '离线'}
                          />
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">是否启用</span>
                            <span className="font-medium">{client.enabled === false ? '否' : '是'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">最后在线</span>
                            <span className="text-gray-700">{client.lastSeen || '-'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
                        <Button
                          variant="secondary"
                          className="mr-2"
                          onClick={() => {
                            setRenameValue(client.name);
                            setRenameModal({ isOpen: true, clientId: client.clientId, name: client.name });
                          }}
                        >
                          修改名称
                        </Button>
                        <Button
                          variant="secondary"
                          isLoading={toggleMutation.isPending}
                          onClick={() =>
                            toggleMutation.mutate({ clientId: client.clientId, enabled: client.enabled === false })
                          }
                        >
                          {client.enabled === false ? '上线' : '下线'}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )
            ) : (
              requestDeviceLoading ? (
                <div className="text-center py-12 text-gray-500">加载中...</div>
              ) : (
                <div className="space-y-6">
                  <Card className="p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">新设备自动放行</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          开启后，新设备首次访问会直接放行；关闭后，需要在防火墙页面手动审批后才会转发。
                        </p>
                      </div>
                      <Button
                        variant={autoApproveNewRequestDevices ? 'primary' : 'secondary'}
                        isLoading={updateRequestDeviceSettingsMutation.isPending}
                        onClick={() =>
                          updateRequestDeviceSettingsMutation.mutate(!autoApproveNewRequestDevices)
                        }
                      >
                        {autoApproveNewRequestDevices ? '已开启' : '已关闭'}
                      </Button>
                    </div>
                  </Card>

                  {requestDeviceData?.devices?.length ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {requestDeviceData.devices.map((device) => (
                        <Card key={device.deviceId} padding="none" hover>
                          <div className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-medium text-gray-900">{device.name || '未知设备'}</h3>
                                <p className="text-sm text-gray-500 mt-0.5">{device.deviceId}</p>
                              </div>
                              <StatusBadge
                                status={device.status === 'approved' ? 'online' : device.status === 'blocked' ? 'offline' : 'pending'}
                                label={device.status === 'approved' ? '已允许' : device.status === 'blocked' ? '已禁止' : '待审批'}
                              />
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">平台</span>
                                <span className="text-gray-700">{device.platform || '-'}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">最近访问</span>
                                <span className="text-gray-700">{device.lastSeen || '-'}</span>
                              </div>
                            </div>

                          </div>

                          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
                            {device.status !== 'approved' && (
                              <Button
                                variant="secondary"
                                className="mr-2"
                                isLoading={updateRequestDeviceMutation.isPending}
                                onClick={() => updateRequestDeviceMutation.mutate({ deviceId: device.deviceId, status: 'approved' })}
                              >
                                允许
                              </Button>
                            )}
                            {device.status !== 'blocked' && (
                              <Button
                                variant="secondary"
                                className="mr-2"
                                isLoading={updateRequestDeviceMutation.isPending}
                                onClick={() => updateRequestDeviceMutation.mutate({ deviceId: device.deviceId, status: 'blocked' })}
                              >
                                禁止
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              isLoading={deleteRequestDeviceMutation.isPending}
                              onClick={() => deleteRequestDeviceMutation.mutate(device.deviceId)}
                            >
                              删除
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      {autoApproveNewRequestDevices
                        ? '暂无访问设备，新设备会默认自动放行'
                        : '暂无访问设备，新设备需要审批后才可访问'}
                    </div>
                  )}
                </div>
              )
            )}
          </PageContainer>
        </main>
      </div>

      <Modal
        isOpen={renameModal.isOpen}
        onClose={() => setRenameModal({ isOpen: false })}
        title="修改设备名称"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="设备名称"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRenameModal({ isOpen: false })}>
              取消
            </Button>
            <Button
              isLoading={renameMutation.isPending}
              onClick={() =>
                renameModal.clientId && renameMutation.mutate({ clientId: renameModal.clientId, name: renameValue.trim() })
              }
            >
              保存
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
